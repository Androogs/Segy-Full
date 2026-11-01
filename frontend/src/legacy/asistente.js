// Asistente Astro: mascota flotante con tarjeta de invitación, panel de conversación, dictado por voz (reconocimiento del
// navegador), lectura de respuestas (síntesis de voz) y acciones de interfaz que devuelve el servidor (p. ej. navegar).
// app.js llama a montarAsistente() cuando hay sesión y a desmontarAsistente() al cerrarla. Toda la lógica de datos y de
// permisos vive en el servidor (/api/asistente/*); aquí solo se pinta y se envía texto.
import { api } from '../lib/api';
import { estado, navegar } from '../lib/estado';
import { $, $$, esc, icono, toast, confirmar, fmt } from './ui.js';

const LS_BURBUJA = 'astro.burbuja';
const LS_LEER = 'astro.leer';
const SS_CONV = 'astro.conversacion';
const MAX_CARACTERES = 2000;

const guardar = {
  local: { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }, del(k) { try { localStorage.removeItem(k); } catch { /* nada */ } } },
  sesion: { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* nada */ } }, del(k) { try { sessionStorage.removeItem(k); } catch { /* nada */ } } },
};

const Reconocimiento = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;
const soportaDictado = () => !!Reconocimiento;
const soportaLectura = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const esCelular = () => window.matchMedia('(max-width: 699px)').matches;
const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Estado del componente (un solo asistente por página).
let raiz = null;
let st = null;              // respuesta de GET /api/asistente/estado
let abierto = false;
let convId = null;
let mensajes = [];          // { id, rol: 'usuario'|'asistente', contenido, acciones, error, reintento, creado_en }
let enviando = false;
let reco = null;
let grabando = false;
let cargandoConv = false;

const ahoraLocal = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const hora = (t) => (t ? String(t).slice(11, 16) : '');
const nombreAstro = () => (st && st.nombre) || 'Astro';
const primerNombre = () => String((estado.usuario && estado.usuario.nombre) || '').split(' ')[0];
const vozPermitida = () => !!(st && st.voz !== false);

// ---------- Montaje / desmontaje ----------
export async function montarAsistente() {
  if (raiz) return;
  if (!estado.usuario || !estado.tiene('asistente.usar')) return;
  if (estado.config && estado.config.asistente && estado.config.asistente.activo === false) return;
  let e = null;
  try { e = await api.get('/api/asistente/estado', { silencioso: true }); } catch { return; }
  if (!e || !e.activo || raiz || !estado.usuario) return;
  st = e;
  convId = Number(guardar.sesion.get(SS_CONV)) || null;
  raiz = document.createElement('div');
  raiz.id = 'astro';
  raiz.className = 'astro';
  raiz.innerHTML = `${plantillaCerrado()}<section class="astro-panel" id="astro-panel" role="dialog" aria-label="Asistente ${esc(nombreAstro())}" hidden></section>`;
  document.body.appendChild(raiz);
  enlazarCerrado();
  document.addEventListener('keydown', alTeclaGlobal);
}

// Se llama al cerrar sesión y cuando el servidor responde 401: quita la mascota y el panel, y olvida la conversación
// recordada en la pestaña para que no cruce a otro usuario que entre después.
export function desmontarAsistente() {
  detenerDictado();
  detenerLectura();
  document.removeEventListener('keydown', alTeclaGlobal);
  if (raiz) raiz.remove();
  raiz = null; st = null; abierto = false; convId = null; mensajes = []; enviando = false; cargandoConv = false;
  guardar.sesion.del(SS_CONV);
}

// ---------- Estado cerrado ----------
function plantillaCerrado() {
  const oculta = guardar.local.get(LS_BURBUJA) === 'oculta';
  const conVoz = soportaDictado() && vozPermitida();
  return `<div class="astro-cerrado" id="astro-cerrado">
    <button type="button" class="astro-mascota" id="astro-mascota" aria-label="Abrir el asistente ${esc(nombreAstro())}"><img src="/icons/astro.webp" alt=""></button>
    <div class="astro-lado">
      <div class="astro-burbuja" id="astro-burbuja" ${oculta ? 'hidden' : ''}><b>¿Tienes alguna duda?</b><p>${conVoz ? 'Pregúntame por texto o por voz, en cualquier hora.' : 'Pregúntame por texto, en cualquier hora.'}</p><button type="button" class="astro-burbuja-x" id="astro-burbuja-x" aria-label="Ocultar este mensaje">${icono('x', 14)}</button></div>
      <button type="button" class="astro-abrir" id="astro-abrir" aria-label="Pregúntale a ${esc(nombreAstro())}">${icono(conVoz ? 'mic' : 'message', 18)}<span>Pregúntale a ${esc(nombreAstro())}</span></button>
    </div></div>`;
}
function enlazarCerrado() {
  $('#astro-mascota', raiz).addEventListener('click', abrirPanel);
  $('#astro-abrir', raiz).addEventListener('click', abrirPanel);
  $('#astro-burbuja-x', raiz).addEventListener('click', (e) => { e.stopPropagation(); $('#astro-burbuja', raiz).hidden = true; guardar.local.set(LS_BURBUJA, 'oculta'); });
}

// ---------- Panel ----------
function plantillaPanel() {
  const disp = !!st.disponible;
  const conDictado = soportaDictado() && vozPermitida();
  const conLectura = soportaLectura() && vozPermitida();
  return `<header class="astro-cab">
      <img class="astro-avatar" src="/icons/astro.webp" alt="">
      <div class="astro-titulo"><b>${esc(nombreAstro())}</b><small>Asistente de ${esc(estado.config.negocio_nombre || 'SEGY')} · <span class="astro-estado ${disp ? 'ok' : ''}"><i aria-hidden="true"></i>${disp ? 'Listo' : 'Sin configurar'}</span></small></div>
      <button type="button" class="btn icono chico fantasma" id="astro-nueva" aria-label="Nueva conversación" title="Nueva conversación">${icono('plus', 18)}</button>
      <button type="button" class="btn icono chico fantasma" id="astro-hist" aria-label="Historial de conversaciones" title="Historial">${icono('clock', 18)}</button>
      <button type="button" class="btn icono chico fantasma" id="astro-cerrar" aria-label="Cerrar el asistente" title="Cerrar (Esc)">${icono('x', 18)}</button>
    </header>
    <div class="astro-mensajes" id="astro-mensajes" aria-live="polite" aria-relevant="additions"></div>
    <footer class="astro-pie">
      <div class="astro-transcripcion" id="astro-transcripcion" hidden></div>
      <div class="astro-entrada">
        <textarea id="astro-texto" class="astro-texto" rows="1" maxlength="${MAX_CARACTERES}" placeholder="${disp ? 'Escribe tu pregunta…' : 'Asistente no disponible'}" aria-label="Mensaje para ${esc(nombreAstro())}" ${disp ? '' : 'disabled'}></textarea>
        ${conDictado ? `<button type="button" class="btn icono" id="astro-mic" aria-label="Dictar por voz" aria-pressed="false" title="Dictar por voz" ${disp ? '' : 'disabled'}>${icono('mic', 20)}</button>` : ''}
        <button type="button" class="btn icono primario" id="astro-enviar" aria-label="Enviar mensaje" title="Enviar" ${disp ? '' : 'disabled'}>${icono('send', 20)}</button>
      </div>
      <div class="astro-opciones">
        ${conLectura ? `<label class="astro-leer"><input type="checkbox" id="astro-leer" ${guardar.local.get(LS_LEER) === '1' ? 'checked' : ''}> Leer respuestas</label>` : '<span></span>'}
        <span class="astro-pista">Enter envía · Shift+Enter salto de línea</span>
      </div>
    </footer>`;
}

async function abrirPanel() {
  if (!raiz || abierto) return;
  abierto = true;
  $('#astro-cerrado', raiz).hidden = true;
  const panel = $('#astro-panel', raiz);
  panel.innerHTML = plantillaPanel();
  panel.hidden = false;
  enlazarPanel();
  pintarMensajes();
  enfocarEntrada();
  if (convId && !mensajes.length) await cargarConversacion(convId, { silencioso: true });
}
function cerrarPanel() {
  if (!raiz || !abierto) return;
  abierto = false;
  detenerDictado();
  detenerLectura();
  $('#astro-panel', raiz).hidden = true;
  $('#astro-cerrado', raiz).hidden = false;
}
function enlazarPanel() {
  $('#astro-cerrar', raiz).addEventListener('click', cerrarPanel);
  $('#astro-nueva', raiz).addEventListener('click', nuevaConversacion);
  $('#astro-hist', raiz).addEventListener('click', mostrarHistorial);
  $('#astro-enviar', raiz).addEventListener('click', () => enviar());
  const ta = $('#astro-texto', raiz);
  ta.addEventListener('input', () => ajustarAltura(ta));
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(); } });
  const mic = $('#astro-mic', raiz);
  if (mic) mic.addEventListener('click', alternarDictado);
  const leer = $('#astro-leer', raiz);
  if (leer) leer.addEventListener('change', () => { guardar.local.set(LS_LEER, leer.checked ? '1' : '0'); if (!leer.checked) detenerLectura(); });
}
function enfocarEntrada() { setTimeout(() => { const t = $('#astro-texto', raiz); if (t && !t.disabled) t.focus(); }, 60); }
function ajustarAltura(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 118) + 'px'; }
function alTeclaGlobal(e) {
  if (e.key !== 'Escape' || !abierto) return;
  // Si hay un modal abierto encima, el Esc es para él.
  if ($('#modales') && $('#modales').children.length) return;
  cerrarPanel();
}

// ---------- Mensajes ----------
// Formato ligero y seguro: primero se escapa el HTML; luego **negritas**, líneas "- " como lista y saltos de línea.
const enLinea = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function formatear(texto) {
  const partes = [];
  let lista = null;
  for (const linea of esc(texto || '').split('\n')) {
    const m = linea.match(/^\s*[-•]\s+(.*)$/);
    if (m) { if (!lista) { lista = []; partes.push(lista); } lista.push(enLinea(m[1])); } else { lista = null; partes.push(enLinea(linea)); }
  }
  let salida = '';
  partes.forEach((p, i) => {
    if (Array.isArray(p)) { salida += `<ul>${p.map((li) => `<li>${li}</li>`).join('')}</ul>`; return; }
    const anterior = partes[i - 1];
    if (i > 0 && !Array.isArray(anterior)) salida += '<br>';
    salida += p;
  });
  return salida;
}
function plantillaMensaje(m) {
  if (m.rol === 'usuario') return `<div class="astro-msg usuario"><div><div class="astro-globo">${formatear(m.contenido)}</div><div class="astro-hora">${esc(hora(m.creado_en))}</div></div></div>`;
  const avatar = `<img class="astro-avatar chico" src="/icons/astro.webp" alt="">`;
  if (m.error) return `<div class="astro-msg asistente">${avatar}<div><div class="astro-error" role="alert"><span>${esc(m.error)}</span>${m.reintento ? `<button type="button" class="btn chico suave" data-reintentar="${esc(m.id)}">${icono('refresh', 14)} Reintentar</button>` : ''}</div><div class="astro-hora">${esc(hora(m.creado_en))}</div></div></div>`;
  const acciones = (m.acciones || []).filter((a) => a && a.tipo === 'navegar' && typeof a.hash === 'string' && /^#\/[\w\-/?=&.%]*$/.test(a.hash)).map((a) => `<div class="astro-accion"><a class="btn chico suave" href="${esc(a.hash)}" data-ir="${esc(a.hash)}">${icono('external', 14)} Ir a ${esc(a.etiqueta || a.hash)}</a></div>`).join('');
  return `<div class="astro-msg asistente">${avatar}<div><div class="astro-globo">${formatear(m.contenido)}${acciones}</div><div class="astro-hora">${esc(hora(m.creado_en))}</div></div></div>`;
}
function pintarMensajes() {
  const cont = $('#astro-mensajes', raiz);
  if (!cont) return;
  let h = '';
  if (!st.disponible) {
    const admin = estado.usuario && estado.usuario.rol === 'admin';
    h += `<div class="alerta aviso astro-aviso">${esc(st.motivo || 'El asistente no está disponible por ahora.')}${admin ? `<div class="mt small">Cómo activarlo: agrega la variable en las variables de entorno del servidor (hPanel › Node.js o archivo <span class="mono">.env</span>) y reinicia la aplicación, o elige otro proveedor o modelo en <a href="#/configuracion/asistente" data-ir="#/configuracion/asistente">Configuración › Asistente Astro</a>.</div>` : ''}</div>`;
  }
  if (cargandoConv) h += '<div class="cargando">Cargando conversación…</div>';
  else if (!mensajes.length) {
    h += `<div class="astro-msg asistente"><img class="astro-avatar chico" src="/icons/astro.webp" alt=""><div><div class="astro-globo">¡Hola${primerNombre() ? ', ' + esc(primerNombre()) : ''}! Soy ${esc(nombreAstro())}. Pregúntame por tus ventas, el inventario, la caja, la TRM o cómo hacer algo en la aplicación.</div></div></div>`;
    if (st.disponible && Array.isArray(st.sugerencias) && st.sugerencias.length) h += `<div class="astro-chips" role="list" aria-label="Preguntas de ejemplo">${st.sugerencias.map((s) => `<button type="button" class="astro-chip" role="listitem" data-chip="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  }
  for (const m of mensajes) h += plantillaMensaje(m);
  if (enviando) h += `<div class="astro-pensando" id="astro-pensando"><img class="astro-avatar chico" src="/icons/astro.webp" alt=""><span>${esc(nombreAstro())} está pensando<i>.</i><i>.</i><i>.</i></span></div>`;
  cont.innerHTML = h;
  $$('[data-chip]', cont).forEach((b) => b.addEventListener('click', () => enviar(b.dataset.chip)));
  $$('[data-reintentar]', cont).forEach((b) => b.addEventListener('click', () => reintentar(b.dataset.reintentar)));
  $$('[data-ir]', cont).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); irA(a.dataset.ir); }));
  cont.scrollTop = cont.scrollHeight;
}
function fijarEnviando(valor) {
  const b = $('#astro-enviar', raiz); const t = $('#astro-texto', raiz); const mic = $('#astro-mic', raiz);
  if (b) b.disabled = valor || !st.disponible;
  if (t) t.disabled = valor || !st.disponible;
  if (mic) mic.disabled = valor || !st.disponible;
}

// El usuario pidió explícitamente ir a una pantalla: en ese caso sí se navega sin esperar a que toque el botón.
const pidioNavegar = (t) => /\b(ll[eé]vame|ll[eé]vanos|[aá]bre(me|nos)?|abrir|ir a|vamos a|ve a|mu[eé]strame la pantalla)\b/i.test(t);

async function enviar(textoDado) {
  if (!raiz || !st.disponible || enviando) return;
  const ta = $('#astro-texto', raiz);
  const texto = String(textoDado ?? (ta ? ta.value : '')).trim();
  if (!texto) return;
  if (texto.length > MAX_CARACTERES) { toast(`El mensaje es demasiado largo (máximo ${MAX_CARACTERES} caracteres)`, 'error'); return; }
  detenerDictado();
  detenerLectura();
  if (ta) { ta.value = ''; ajustarAltura(ta); }
  mensajes.push({ id: 'u' + Date.now(), rol: 'usuario', contenido: texto, creado_en: ahoraLocal() });
  enviando = true;
  fijarEnviando(true);
  pintarMensajes();
  try {
    const r = await api.post('/api/asistente/mensajes', { conversacion_id: convId, mensaje: texto, contexto: { ruta: location.hash || '#/inicio', titulo: document.title } });
    convId = r.conversacion_id;
    guardar.sesion.set(SS_CONV, String(convId));
    mensajes.push({ id: 'a' + Date.now(), rol: 'asistente', contenido: r.respuesta, acciones: r.acciones || [], creado_en: r.creado_en || ahoraLocal() });
    if (leerActivo()) leer(r.respuesta);
    const nav = (r.acciones || []).find((a) => a.tipo === 'navegar' && a.hash);
    if (nav && pidioNavegar(texto)) irA(nav.hash);
  } catch (e) {
    if (e && e.datos && e.datos.conversacion_id) { convId = e.datos.conversacion_id; guardar.sesion.set(SS_CONV, String(convId)); }
    if (e && e.status === 503 && (e.codigo === 'asistente_no_configurado' || e.codigo === 'asistente_desactivado')) { st.disponible = false; st.motivo = e.message; }
    const puedeReintentar = !(e && (e.status === 400 || e.status === 403));
    mensajes.push({ id: 'e' + Date.now(), rol: 'asistente', error: mensajeError(e), reintento: puedeReintentar ? texto : null, creado_en: ahoraLocal() });
  } finally {
    enviando = false;
    fijarEnviando(false);
    pintarMensajes();
    enfocarEntrada();
  }
}
function mensajeError(e) {
  if (!e) return 'Ocurrió un error inesperado.';
  if (e.status === 0) return 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  if (e.status === 429) return e.message || 'Alcanzaste el límite de mensajes por hora. Intenta más tarde.';
  return e.message || 'No se pudo obtener respuesta.';
}
function reintentar(id) {
  const i = mensajes.findIndex((m) => m.id === id);
  if (i < 0) return;
  const texto = mensajes[i].reintento;
  mensajes.splice(i, 1);
  // Quita también el mensaje del usuario que quedó sin respuesta para no duplicarlo en pantalla.
  if (i > 0 && mensajes[i - 1] && mensajes[i - 1].rol === 'usuario' && mensajes[i - 1].contenido === texto) mensajes.splice(i - 1, 1);
  enviar(texto);
}
function irA(hash) {
  if (!hash) return;
  navegar(hash);
  if (esCelular()) cerrarPanel();
}

// ---------- Conversaciones ----------
function nuevaConversacion() {
  convId = null;
  guardar.sesion.del(SS_CONV);
  mensajes = [];
  detenerLectura();
  pintarMensajes();
  enfocarEntrada();
}
async function cargarConversacion(id, { silencioso = false } = {}) {
  cargandoConv = true;
  pintarMensajes();
  try {
    const c = await api.get(`/api/asistente/conversaciones/${id}`);
    convId = c.id;
    guardar.sesion.set(SS_CONV, String(convId));
    mensajes = [];
    let ultimoUsuario = null;
    for (const m of c.mensajes || []) {
      if (m.rol === 'usuario') { ultimoUsuario = m.contenido; mensajes.push({ id: 'm' + m.id, rol: 'usuario', contenido: m.contenido, creado_en: m.creado_en }); }
      else if (m.rol === 'asistente') {
        if (m.error) mensajes.push({ id: 'm' + m.id, rol: 'asistente', error: m.error, reintento: ultimoUsuario, creado_en: m.creado_en });
        else mensajes.push({ id: 'm' + m.id, rol: 'asistente', contenido: m.contenido, acciones: m.acciones || [], creado_en: m.creado_en });
      }
    }
  } catch (e) {
    convId = null; guardar.sesion.del(SS_CONV); mensajes = [];
    if (!silencioso) toast(e.message || 'No se pudo abrir la conversación', 'error');
  } finally {
    cargandoConv = false;
    pintarMensajes();
  }
}
async function mostrarHistorial() {
  const cont = $('#astro-mensajes', raiz);
  if (!cont) return;
  detenerDictado();
  cont.innerHTML = '<div class="cargando">Cargando…</div>';
  let lista = [];
  try { lista = await api.get('/api/asistente/conversaciones'); } catch (e) { cont.innerHTML = `<div class="astro-error" role="alert">${esc(e.message || 'No se pudo cargar el historial')}</div>`; return; }
  cont.innerHTML = `<div class="astro-hist-cab"><b>Tus conversaciones</b><button type="button" class="btn chico suave" id="astro-hist-volver">${icono('back', 14)} Volver</button></div>
    ${lista.length ? `<div class="lista">${lista.map((c) => `<div class="item ${c.id === convId ? 'activo' : ''}"><button type="button" class="astro-hist-item" data-abrir="${c.id}" aria-label="Abrir conversación: ${esc(c.titulo || 'Conversación')}"><div class="titulo">${esc(c.titulo || 'Conversación')}</div><div class="sub">${esc(c.ultimo || 'Sin respuesta todavía')}</div><div class="xs muted">${esc(fmt.fechaHora(c.actualizado_en))} · ${Number(c.n_mensajes) || 0} mensajes</div></button><button type="button" class="btn icono chico fantasma" data-borrar="${c.id}" aria-label="Eliminar conversación" title="Eliminar">${icono('trash', 16)}</button></div>`).join('')}</div>` : '<div class="vacio"><p>Aún no tienes conversaciones guardadas.</p></div>'}`;
  $('#astro-hist-volver', cont).addEventListener('click', pintarMensajes);
  $$('[data-abrir]', cont).forEach((b) => b.addEventListener('click', () => cargarConversacion(Number(b.dataset.abrir))));
  $$('[data-borrar]', cont).forEach((b) => b.addEventListener('click', async () => {
    if (!await confirmar('¿Eliminar esta conversación? No se puede deshacer.', { textoOk: 'Eliminar', peligro: true })) return;
    try {
      await api.del(`/api/asistente/conversaciones/${b.dataset.borrar}`);
      if (Number(b.dataset.borrar) === convId) { convId = null; guardar.sesion.del(SS_CONV); mensajes = []; }
      toast('Conversación eliminada', 'ok');
      mostrarHistorial();
    } catch (e) { toast(e.message || 'No se pudo eliminar', 'error'); }
  }));
}

// ---------- Voz: dictado (reconocimiento) ----------
function alternarDictado() {
  if (grabando) { detenerDictado(); return; }
  if (!Reconocimiento || !raiz) return;
  const ta = $('#astro-texto', raiz);
  const tr = $('#astro-transcripcion', raiz);
  const base = ta.value.trim() ? ta.value.trim() + ' ' : '';
  try {
    reco = new Reconocimiento();
  } catch { toast('Tu navegador no permite el dictado por voz', 'error'); return; }
  reco.lang = 'es-CO';
  reco.continuous = false;
  reco.interimResults = true;
  reco.maxAlternatives = 1;
  reco.onresult = (ev) => {
    let final = ''; let parcial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) final += r[0].transcript; else parcial += r[0].transcript; }
    if (final) { ta.value = (base + final).trim(); ajustarAltura(ta); }
    tr.textContent = parcial ? `Escuchando: ${parcial}` : (final ? 'Listo. Revisa el texto y envíalo.' : 'Escuchando…');
  };
  reco.onerror = (ev) => {
    const codigo = ev && ev.error;
    detenerDictado();
    if (codigo === 'not-allowed' || codigo === 'service-not-allowed') toast('No hay permiso para usar el micrófono. Actívalo en el navegador.', 'error');
    else if (codigo === 'no-speech') toast('No escuché nada. Intenta de nuevo.', '');
    else if (codigo && codigo !== 'aborted') toast('No se pudo reconocer la voz. Intenta de nuevo.', 'error');
  };
  reco.onend = () => {
    grabando = false; reco = null;
    marcarMic();
    setTimeout(() => { const t = $('#astro-transcripcion', raiz); if (t) t.hidden = true; }, 1500);
    enfocarEntrada();
  };
  try {
    reco.start();
    grabando = true;
    marcarMic();
    tr.hidden = false;
    tr.textContent = 'Escuchando…';
  } catch { grabando = false; reco = null; marcarMic(); toast('No se pudo iniciar el dictado', 'error'); }
}
function detenerDictado() {
  if (reco) { try { reco.stop(); } catch { /* ya detenido */ } }
  grabando = false;
  marcarMic();
}
function marcarMic() {
  const mic = raiz && $('#astro-mic', raiz);
  if (!mic) return;
  mic.classList.toggle('grabando', grabando);
  mic.setAttribute('aria-pressed', String(grabando));
  mic.setAttribute('aria-label', grabando ? 'Detener el dictado' : 'Dictar por voz');
  mic.innerHTML = icono(grabando ? 'mic_off' : 'mic', 20);
}

// ---------- Voz: lectura de respuestas (síntesis) ----------
const leerActivo = () => { const c = raiz && $('#astro-leer', raiz); return !!(c && c.checked && soportaLectura()); };
function elegirVoz() {
  const voces = window.speechSynthesis.getVoices() || [];
  for (const pref of ['es-co', 'es-mx', 'es-es', 'es-419', 'es']) { const v = voces.find((x) => x.lang && x.lang.toLowerCase().replace('_', '-').startsWith(pref)); if (v) return v; }
  return null;
}
function leer(texto) {
  if (!soportaLectura()) return;
  const limpio = String(texto || '').replace(/\*\*/g, '').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  if (!limpio) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(limpio);
    const voz = elegirVoz();
    if (voz) u.voice = voz;
    u.lang = voz ? voz.lang : 'es-CO';
    u.rate = reducirMovimiento() ? 1 : 1.02;
    window.speechSynthesis.speak(u);
  } catch { /* sin voz disponible */ }
}
function detenerLectura() { if (soportaLectura()) { try { window.speechSynthesis.cancel(); } catch { /* nada */ } } }
