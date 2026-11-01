// Recibir celular usado: lista, asistente de 4 pasos (identificar → inspeccionar → valorar → confirmar) con borradores,
// y ficha de recepción. Pocas palabras en pantalla: la explicación detallada vive detrás de "Ver cómo se calcula".
import { api } from '../../lib/api';
import { estado, navegar } from '../../lib/estado';
import { $, $$, fmt, icono, esc, badge, ESTADOS_USADO, DESTINOS_USADO, CLASIFICACION_USADO, NIVELES_USADO, NIVELES_SEGURIDAD, nombreMetodo, toast, modal, confirmar, pedirTexto, mostrarError, debounce, activarDinero, leerDinero, vacio, cargando, selectorBusqueda, hoyISO } from '../ui.js';
import { escanear } from '../scanner.js';
import { capturar } from '../camera.js';
import { kpi } from '../paneles.js';
import { abrirGlosario } from '../ayuda.js';

// Grado comercial del usado (se muestra en Vender). El sugerido sale de la depreciación por condición de la inspección.
export const GRADOS_TXT = { A: 'Como nuevo', B: 'Buen estado', C: 'Uso visible' };
export const gradoBadge = (g) => (g ? `<span class="badge grado grado-${esc(g)}" title="${esc(GRADOS_TXT[g] || '')}">Grado ${esc(g)}</span>` : '');

let catalogo = null;
async function cargarCatalogo() { if (!catalogo) catalogo = await api.get('/api/usados/catalogo'); return catalogo; }

export async function render(root, { partes, query, setTopbar }) {
  const [id, sub] = partes;
  if (!id) return lista(root, query, setTopbar);
  if (id === 'nuevo') { try { const u = await api.post('/api/usados', {}); return navegar(`#/usados/${u.id}/editar`, true); } catch (e) { mostrarError(e); return navegar('#/usados', true); } }
  if (sub === 'editar') return asistente(root, Number(id), setTopbar, query);
  return ficha(root, Number(id), setTopbar);
}

// ---------- Lista ----------
async function lista(root, query, setTopbar) {
  const puede = estado.tiene('usados.registrar');
  setTopbar({ titulo: 'Celulares usados', acciones: puede ? [{ icono: 'plus', titulo: 'Recibir celular', href: '#/usados/nuevo' }] : [] });
  const f = { estado: query.estado || 'abiertas', q: '' };
  root.innerHTML = `<div id="us-kpis" class="kpis mb"></div>
    <div class="row between wrap mb"><div class="pills" id="us-pills"></div>${puede ? `<a class="btn primario chico" href="#/usados/nuevo">${icono('plus', 16)} Recibir celular</a>` : ''}</div>
    <div class="buscador">${icono('search')}<input type="search" id="us-q" placeholder="IMEI, modelo, cliente o número"></div>
    <div id="us-lista" class="lista mt"></div>`;
  api.get('/api/usados/resumen').then((r) => {
    $('#us-kpis', root).innerHTML = kpi({ icono: 'phone', titulo: 'Recibidos este mes', valor: fmt.num(r.recibidos_mes), descripcion: `${r.vendidos_mes} ya vendidos`, clase: 'acento' }) +
      kpi({ icono: 'alert', titulo: 'Pendientes', valor: fmt.num(r.pendientes_inspeccion), descripcion: `${r.pendientes_aprobacion} por aprobar`, alerta: r.pendientes_aprobacion > 0 }) +
      kpi({ icono: 'box', titulo: 'En inventario', valor: fmt.num(r.en_stock.n), descripcion: `invertido ${fmt.cop(r.en_stock.invertido)}` });
  }).catch(() => {});
  const cargar = async () => {
    $('#us-lista', root).innerHTML = String(cargando(3));
    try {
      const r = await api.get('/api/usados' + api.qs({ estado: f.estado === 'todas' ? '' : f.estado, q: f.q }));
      const c = r.conteo;
      $('#us-pills', root).innerHTML = [['abiertas', 'En proceso', (c.borrador || 0) + (c.pendiente_aprobacion || 0)], ['aprobada', 'Aprobadas', c.aprobada || 0], ['rechazada', 'Rechazadas', c.rechazada || 0], ['todas', 'Todas', null]].map(([v, t, n]) => `<button class="pill ${f.estado === v ? 'activo' : ''}" data-e="${v}">${t}${n !== null ? ` · ${n}` : ''}</button>`).join('');
      $$('[data-e]', root).forEach((b) => b.addEventListener('click', () => { f.estado = b.dataset.e; cargar(); }));
      $('#us-lista', root).innerHTML = r.usados.length ? r.usados.map((u) => {
        const abierta = ['borrador', 'pendiente_aprobacion'].includes(u.estado);
        const href = u.estado === 'borrador' ? `#/usados/${u.id}/editar` : `#/usados/${u.id}`;
        const titulo = [u.marca, u.modelo, u.capacidad].filter(Boolean).join(' ') || 'Sin identificar';
        const est = u.estado === 'aprobada' ? badge(DESTINOS_USADO, u.destino) : badge(ESTADOS_USADO, u.estado);
        return `<a class="item" href="${href}"><div class="thumb">${icono('phone', 20)}</div><div class="cuerpo"><div class="titulo">${esc(titulo)}${u.estado === 'borrador' ? ` <span class="muted xs">· paso ${u.paso}/4</span>` : ''}</div><div class="sub">${esc(u.numero)}${u.imei1 ? ' · ' + esc(u.imei1) : ''}${u.vendedor_nombre ? ' · ' + esc(u.vendedor_nombre) : ''} · ${esc(u.empleado_nombre || '')} · ${fmt.fecha(u.fecha_recepcion)}</div></div><div class="fin"><div class="valor">${u.oferta_final ? fmt.cop(u.oferta_final) : '—'}</div><div class="xs">${u.estado === 'aprobada' ? gradoBadge(u.grado) + ' ' : ''}${String(est)}${abierta && u.clasificacion ? ' ' + String(badge(CLASIFICACION_USADO, u.clasificacion)) : ''}</div></div></a>`;
      }).join('') : String(vacio('No hay recepciones con este filtro', puede ? '<a class="btn primario mt" href="#/usados/nuevo">Recibir celular</a>' : ''));
    } catch (e) { mostrarError(e); }
  };
  $('#us-q', root).addEventListener('input', debounce((e) => { f.q = e.target.value.trim(); cargar(); }));
  cargar();
}

// ---------- Asistente (4 pasos) ----------
const PASOS = [['Identificar', 'Equipo y cliente'], ['Inspeccionar', 'Verificación y fotos'], ['Valorar', 'Precio y oferta'], ['Confirmar', 'Aceptación y registro']];

async function asistente(root, id, setTopbar, query = {}) {
  let u;
  try { [u] = await Promise.all([api.get(`/api/usados/${id}`), cargarCatalogo()]); } catch (e) { mostrarError(e); return navegar('#/usados', true); }
  if (!['borrador', 'pendiente_aprobacion'].includes(u.estado)) return navegar(`#/usados/${id}`, true);
  // Solo quien negocia el equipo (o el empleador) edita; los demás ven la ficha.
  if (!estado.tiene('usados.registrar') || (u.empleado_id !== estado.usuario.id && !estado.tiene('usados.aprobar'))) return navegar(`#/usados/${id}`, true);
  let paso = Number(query.paso) || u.paso || 1;
  let guardando = null;
  setTopbar({ titulo: `Recibir usado · ${u.numero}`, atras: '#/usados', acciones: [{ icono: 'eye', titulo: 'Ver ficha', href: `#/usados/${id}` }] });
  root.innerHTML = `<div class="pasos" id="as-pasos"></div><div id="as-cuerpo"></div><div class="pie-asistente"><div class="izq"><span class="autoguardado" id="as-estado">Borrador guardado</span></div><div class="der" id="as-botones"></div></div>`;

  const guardar = async (datos, { silencioso = true } = {}) => {
    const el = $('#as-estado', root); if (el) el.textContent = 'Guardando…';
    try { u = await api.put(`/api/usados/${id}`, { ...datos, paso }); if (el) el.textContent = `Guardado ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`; if (!silencioso) toast('Borrador guardado', 'ok'); return u; }
    catch (e) { if (el) el.textContent = 'No se pudo guardar'; mostrarError(e); return null; }
  };
  const guardarDebounce = debounce((d) => { guardando = guardar(d); }, 500);
  const pintarPasos = () => {
    $('#as-pasos', root).innerHTML = PASOS.map(([t, s], i) => `<button type="button" class="${paso === i + 1 ? 'activo' : paso > i + 1 ? 'hecho' : ''}" data-paso="${i + 1}"><div class="barra"></div>${i + 1}. ${t}<span class="n">${s}</span></button>`).join('');
    $$('[data-paso]', root).forEach((b) => b.addEventListener('click', () => ir(Number(b.dataset.paso))));
    const der = $('#as-botones', root);
    der.innerHTML = `${paso > 1 ? `<button class="btn suave" id="as-atras">${icono('back', 16)} Atrás</button>` : ''}${paso < 4 ? `<button class="btn primario" id="as-sig">Siguiente ${icono('chevron', 16)}</button>` : ''}`;
    const ba = $('#as-atras', root); if (ba) ba.addEventListener('click', () => ir(paso - 1));
    const bs = $('#as-sig', root); if (bs) bs.addEventListener('click', () => ir(paso + 1));
  };
  const ir = async (n) => { if (guardando) await guardando; paso = Math.max(1, Math.min(4, n)); await guardar({}); pintar(); window.scrollTo(0, 0); };
  const pintar = () => { pintarPasos(); const c = $('#as-cuerpo', root); ({ 1: paso1, 2: paso2, 3: paso3, 4: paso4 })[paso](c); };

  // Paso 1 · Identificar
  function paso1(c) {
    const admin = estado.tiene('comisiones.administrar');
    c.innerHTML = `<form id="f1" class="card">
      <h2>Equipo</h2>
      <div class="grid2">
        <div class="campo"><label>Marca *</label><input name="marca" value="${esc(u.marca || '')}" placeholder="Samsung, Apple…"></div>
        <div class="campo"><label>Modelo *</label><input name="modelo" value="${esc(u.modelo || '')}" placeholder="Galaxy S23, iPhone 13…"></div>
        <div class="campo"><label>Capacidad</label><input name="capacidad" value="${esc(u.capacidad || '')}" placeholder="128GB"></div>
        <div class="campo"><label>Color</label><input name="color" value="${esc(u.color || '')}"></div>
        <div class="campo"><label>IMEI 1 *</label><div class="row"><input name="imei1" class="grow mono" inputmode="numeric" value="${esc(u.imei1 || '')}"><button type="button" class="btn icono" data-scan="imei1" title="Escanear">${icono('scan')}</button></div></div>
        <div class="campo"><label>IMEI 2</label><div class="row"><input name="imei2" class="grow mono" inputmode="numeric" value="${esc(u.imei2 || '')}"><button type="button" class="btn icono" data-scan="imei2" title="Escanear">${icono('scan')}</button></div></div>
        <div class="campo"><label>Número de serie</label><input name="serial" class="mono" value="${esc(u.serial || '')}"></div>
        <div class="campo"><label>Antigüedad (años)</label><input name="antiguedad_anios" type="number" min="0" step="0.5" inputmode="decimal" value="${u.antiguedad_anios ?? ''}"></div>
        <div class="campo"><label>Accesorios incluidos</label><input name="accesorios" value="${esc(u.accesorios || '')}" placeholder="Cargador, caja, estuche…"></div>
        <div class="campo"><label>Recibido</label><input value="${esc(fmt.fechaHora(u.fecha_recepcion))}" readonly></div>
      </div>
      <h2 class="mt">Quien entrega el equipo</h2>
      <div class="grid2">
        <div class="campo"><label>Nombre *</label><div class="row"><input name="vendedor_nombre" class="grow" value="${esc(u.vendedor_nombre || '')}"><button type="button" class="btn icono" id="f1-cliente" title="Buscar cliente registrado">${icono('users')}</button></div>${u.cliente_nombre ? `<div class="ayuda">Cliente registrado: ${esc(u.cliente_nombre)}</div>` : ''}</div>
        <div class="campo"><label>Teléfono / contacto</label><input name="vendedor_contacto" value="${esc(u.vendedor_contacto || '')}"></div>
        <div class="campo"><label>Identificación</label><input name="vendedor_identificacion" value="${esc(u.vendedor_identificacion || '')}"></div>
        ${admin ? `<div class="campo"><label>Empleado que negocia</label><select name="empleado_id" id="f1-emp"><option value="${u.empleado_id}">${esc(u.empleado_nombre || '')}</option></select></div>` : `<div class="campo"><label>Empleado que negocia</label><input value="${esc(u.empleado_nombre || estado.usuario.nombre)}" readonly></div>`}
      </div>
      <h2 class="mt">Referencias de precio</h2>
      <div class="grid2">
        <div class="campo"><label>Precio del celular nuevo equivalente</label><input name="precio_nuevo_referencia" data-money value="${u.precio_nuevo_referencia || ''}"></div>
        <div class="campo"><label>Valor de mercado del usado (reventa)</label><input name="valor_mercado" data-money value="${u.valor_mercado || ''}"><div class="ayuda">Si lo dejas vacío se estima desde el precio del nuevo y se marca como estimación.</div></div>
      </div>
      <div class="campo"><label>Observaciones</label><textarea name="observaciones" rows="2">${esc(u.observaciones || '')}</textarea></div>
    </form>`;
    activarDinero(c);
    const form = $('#f1', c);
    const leer = () => { const d = {}; for (const el of form.elements) { if (!el.name) continue; d[el.name] = el.dataset.money !== undefined ? (el.value ? leerDinero(el) : null) : el.value; } return d; };
    form.addEventListener('input', () => guardarDebounce(leer()));
    form.addEventListener('change', () => guardarDebounce(leer()));
    $$('[data-scan]', c).forEach((b) => b.addEventListener('click', async () => { const v = await escanear(); if (v) { form[b.dataset.scan].value = v.replace(/\D/g, ''); guardarDebounce(leer()); } }));
    $('#f1-cliente', c).addEventListener('click', () => selectorBusqueda({ titulo: 'Cliente registrado', placeholder: 'Nombre, teléfono o cédula', buscar: async (t) => (await api.get('/api/clientes' + api.qs({ q: t }))).map((x) => ({ id: x.id, titulo: x.nombre, sub: x.telefono || '', datos: x })), alElegir: (it) => { form.vendedor_nombre.value = it.datos.nombre; form.vendedor_contacto.value = it.datos.telefono || ''; form.vendedor_identificacion.value = it.datos.identificacion || ''; guardar({ ...leer(), cliente_id: it.id }).then(() => pintar()); } }));
    if (admin) api.get('/api/usuarios').then((us) => { const s = $('#f1-emp', c); if (s) s.innerHTML = us.filter((x) => x.activo !== 0).map((x) => `<option value="${x.id}" ${x.id === u.empleado_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join(''); }).catch(() => {});
  }

  // Paso 2 · Inspeccionar
  function paso2(c) {
    const insp = { ...(u.inspeccion || {}) };
    const reparar = new Set(u.inspeccion_reparar || []);
    const total = catalogo.grupos.flatMap((g) => g.items.filter((i) => i.obligatorio)).length;
    const hechas = () => catalogo.grupos.flatMap((g) => g.items.filter((i) => i.obligatorio)).filter((i) => insp[i.clave] && insp[i.clave] !== 'no_verificado').length;
    const filaItem = (g, it) => {
      const n = insp[it.clave] || 'no_verificado';
      const niveles = g.seguridad ? Object.entries(NIVELES_SEGURIDAD) : Object.entries(NIVELES_USADO);
      const bateria = it.clave === 'bateria_salud' ? `<input type="number" min="0" max="100" inputmode="numeric" placeholder="%" value="${u.bateria_pct ?? ''}" data-bateria style="width:72px;min-height:34px;padding:4px 8px">` : '';
      const rep = !g.seguridad && ['regular', 'deficiente', 'no_funciona'].includes(n) ? `<label class="reparar" title="El costo de reparación cubre este defecto: no se descuenta dos veces"><input type="checkbox" data-rep="${it.clave}" ${reparar.has(it.clave) ? 'checked' : ''}> se repara</label>` : '';
      return `<div class="insp-item"><div class="nombre">${esc(it.nombre)}${it.obligatorio ? '' : '<span class="xs muted">opcional</span>'}</div>${bateria}<div class="niveles">${niveles.map(([v, t]) => `<button type="button" class="nivel ${v} ${n === v ? 'activo' : ''}" data-item="${it.clave}" data-nivel="${v}">${t}</button>`).join('')}</div>${rep}</div>`;
    };
    c.innerHTML = `<div class="row between mb"><h2 style="margin:0">Inspección</h2><span class="badge ${hechas() === total ? 'ok' : 'aviso'}" id="i-prog">${hechas()} / ${total} verificadas</span></div>
      <div class="row wrap gap mb"><button type="button" class="btn chico suave" id="i-todo-ok">Marcar todo "Excelente"</button><span class="xs muted">Luego ajusta lo que no lo esté. "No verificado" nunca cuenta como bueno.</span></div>
      ${catalogo.grupos.map((g) => `<div class="insp-grupo" data-grupo="${g.clave}"><h3>${esc(g.nombre)}${g.seguridad ? '<span class="badge neutro">bloquea la compra si no cumple</span>' : ''}</h3>${g.items.map((it) => filaItem(g, it)).join('')}</div>`).join('')}
      <div class="card"><h2>Fotografías</h2><div class="fotos-grid" id="i-fotos"></div></div>
      <div class="card"><div class="campo" style="margin:0"><label>Observaciones del inspector</label><textarea id="i-obs" rows="2" placeholder="Daños específicos, detalles relevantes…">${esc(u.observaciones_inspector || '')}</textarea></div></div>`;
    const sincronizar = () => { const p = $('#i-prog', c); if (p) { p.textContent = `${hechas()} / ${total} verificadas`; p.className = `badge ${hechas() === total ? 'ok' : 'aviso'}`; } };
    const marcar = (clave, nivel) => {
      insp[clave] = nivel;
      const fila = $(`[data-item="${clave}"]`, c).closest('.insp-item');
      $$('.nivel', fila).forEach((b) => b.classList.toggle('activo', b.dataset.nivel === nivel));
      const g = catalogo.grupos.find((x) => x.items.some((i) => i.clave === clave));
      const it = g.items.find((i) => i.clave === clave);
      fila.outerHTML = filaItem(g, it);
      activarFila(clave); sincronizar();
      guardarDebounce({ inspeccion: insp, inspeccion_reparar: [...reparar] });
    };
    const activarFila = (clave) => {
      const fila = $(`[data-item="${clave}"]`, c).closest('.insp-item');
      $$('.nivel', fila).forEach((b) => b.addEventListener('click', () => marcar(clave, b.dataset.nivel)));
      const rep = $('[data-rep]', fila); if (rep) rep.addEventListener('change', () => { if (rep.checked) reparar.add(clave); else reparar.delete(clave); guardarDebounce({ inspeccion: insp, inspeccion_reparar: [...reparar] }); });
      const bat = $('[data-bateria]', fila); if (bat) bat.addEventListener('change', () => { const v = Number(bat.value); const nivel = !bat.value ? null : v >= 85 ? 'excelente' : v >= 75 ? 'bueno' : v >= 65 ? 'regular' : 'deficiente'; guardarDebounce({ bateria_pct: bat.value ? v : null }); if (nivel) marcar('bateria_salud', nivel); });
    };
    catalogo.grupos.forEach((g) => g.items.forEach((it) => activarFila(it.clave)));
    $('#i-todo-ok', c).addEventListener('click', () => { catalogo.grupos.forEach((g) => g.items.forEach((it) => { insp[it.clave] = 'excelente'; })); guardar({ inspeccion: insp, inspeccion_reparar: [...reparar] }).then(() => paso2(c)); });
    $('#i-obs', c).addEventListener('input', (e) => guardarDebounce({ observaciones_inspector: e.target.value }));
    const pintarFotos = () => {
      const g = $('#i-fotos', c);
      const tipos = [['frontal', 'Frontal *'], ['trasera', 'Trasera *'], ['dano', 'Daño'], ['otra', 'Otra']];
      g.innerHTML = u.fotos.map((f) => `<div class="foto"><img src="/api/archivos/${esc(f.ruta)}" alt=""><span class="tipo">${esc({ frontal: 'Frontal', trasera: 'Trasera', dano: 'Daño', otra: 'Otra' }[f.tipo] || f.tipo)}</span><button type="button" data-del="${f.id}" aria-label="Eliminar">×</button></div>`).join('') +
        tipos.filter(([t]) => !(t === 'frontal' || t === 'trasera') || !u.fotos.some((f) => f.tipo === t)).map(([t, n]) => `<button type="button" class="agregar" data-foto="${t}">${icono('camera', 22)}${n}</button>`).join('');
      $$('[data-foto]', g).forEach((b) => b.addEventListener('click', async () => { const f = await capturar({ camara: true, soloImagen: true }); if (!f) return; try { await api.post(`/api/usados/${id}/fotos`, { imagen: f.dataUrl, tipo: b.dataset.foto }); u = await api.get(`/api/usados/${id}`); pintarFotos(); toast('Foto agregada', 'ok'); } catch (e) { mostrarError(e); } }));
      $$('[data-del]', g).forEach((b) => b.addEventListener('click', async () => { if (await confirmar('¿Eliminar esta foto?', { peligro: true, textoOk: 'Eliminar' })) { try { await api.del(`/api/usados/${id}/fotos/${b.dataset.del}`); u = await api.get(`/api/usados/${id}`); pintarFotos(); } catch (e) { mostrarError(e); } } }));
    };
    pintarFotos();
  }

  // Paso 3 · Valorar
  function paso3(c) {
    const v = u.valoracion;
    const cfg = catalogo.config;
    const money = (x) => (x === null || x === undefined ? '—' : fmt.cop(x));
    // Orden pedido por el cliente: de izquierda a derecha Oferta → Costo máximo → Valor de mercado.
    c.innerHTML = `<div class="row between wrap mb"><span class="muted small">Precio y oferta</span><button type="button" class="btn chico fantasma" id="v-glosario">${icono('book', 16)} ¿Qué significa cada valor?</button></div>
      <div class="valor-cards">
        <div class="valor-card oferta"><div class="et">Oferta al cliente</div><input id="v-oferta" data-money value="${u.oferta_final ?? v.oferta ?? ''}" placeholder="${v.oferta_sugerida ? fmt.num(v.oferta_sugerida) : ''}"><div class="de">sugerida ${money(v.oferta_sugerida)}${v.margen_esperado !== null ? ` · margen esperado ${fmt.cop(v.margen_esperado)}` : ''}</div></div>
        <div class="valor-card"><div class="et">Costo máximo de adquisición</div><div class="va">${money(v.costo_maximo)}</div><div class="de">reventa − reparación − preparación − riesgo − margen</div></div>
        <div class="valor-card"><div class="et">Valor de mercado (reventa)</div><div class="va">${money(v.valor_ajustado)}</div><div class="de">${v.base === null ? 'Falta valor de mercado o precio del nuevo' : `${v.estimado ? 'estimado desde el nuevo · ' : ''}base ${fmt.cop(v.base)} − ${v.depreciacion.condicion_pct} % por condición`}</div></div>
      </div>
      <div class="card mt"><div class="row between wrap"><div><h2 style="margin:0">Grado del equipo</h2><div class="muted xs">Así aparecerá en Vender. Sugerido por la inspección: <b>Grado ${esc(v.grado_sugerido)}</b> (−${v.depreciacion.condicion_pct} % por condición)</div></div>
        <div class="grados" role="radiogroup" aria-label="Grado del equipo">${(catalogo.grados || ['A', 'B', 'C']).map((g) => `<button type="button" role="radio" class="grado-op ${v.grado === g ? 'activo' : ''}" aria-checked="${v.grado === g}" data-grado="${g}"><b>${g}</b><span>${esc(GRADOS_TXT[g])}</span></button>`).join('')}</div></div></div>
      <div class="resultado-neg ${v.clasificacion} mt" id="v-res"></div>
      ${v.requiere_excepcion ? `<div class="card mt"><div class="campo" style="margin:0"><label>Motivo de la excepción (oferta por encima del costo máximo) *</label><input id="v-exc" value="${esc(u.excepcion_motivo || '')}" placeholder="Ej. cliente frecuente, equipo muy demandado"><div class="ayuda">Requiere aprobación del empleador.</div></div></div>` : ''}
      <div class="card mt"><h2>Costos y márgenes</h2><p class="muted xs mb">Vacío = valor por defecto configurado.</p>
        <div class="grid2">
          <div class="campo"><label>Reparaciones necesarias</label><input id="v-rep" data-money value="${u.costo_reparacion ?? ''}" placeholder="0"></div>
          <div class="campo"><label>Preparación (limpieza, software…)</label><input id="v-prep" data-money value="${u.costo_preparacion ?? ''}" placeholder="${fmt.num(cfg.preparacion_defecto)}"></div>
          <div class="campo"><label>Reserva de riesgo</label><input id="v-res-r" data-money value="${u.reserva_riesgo ?? ''}" placeholder="${cfg.reserva_riesgo_pct} % de la reventa"></div>
          <div class="campo"><label>Margen objetivo</label><input id="v-marg" data-money value="${u.margen_objetivo ?? ''}" placeholder="${cfg.margen_objetivo_pct} % de la reventa"></div>
          <div class="campo"><label>Valor de mercado del usado</label><input id="v-merc" data-money value="${u.valor_mercado ?? ''}"></div>
          <div class="campo"><label>Precio del nuevo equivalente</label><input id="v-nuevo" data-money value="${u.precio_nuevo_referencia ?? ''}"></div>
        </div>
        <details class="mas"><summary>Ver cómo se calcula</summary>
          <dl class="kv"><dt>Valor base (${v.base_origen === 'mercado' ? 'mercado' : v.base_origen ? 'estimado: nuevo × ' + cfg.factor_usado_sobre_nuevo_pct + ' % − antigüedad ' + v.depreciacion.antiguedad_pct + ' %' : 'sin dato'})</dt><dd>${money(v.base)}</dd>
            ${Object.entries(v.depreciacion.grupos).map(([g, x]) => `<dt>&nbsp;&nbsp;${esc(catalogo.grupos.find((y) => y.clave === g).nombre)}: ${x.peor ? esc(NIVELES_USADO[x.peor]) : 'sin defectos'}</dt><dd>− ${x.pct} %</dd>`).join('')}
            <dt>Depreciación por condición (tope ${cfg.tope_depreciacion_pct} %)</dt><dd>− ${v.depreciacion.condicion_pct} %</dd>
            <dt class="bold">Valor ajustado (reventa esperada)</dt><dd class="total">${money(v.valor_ajustado)}</dd>
            <dt>− Reparación</dt><dd>${fmt.cop(v.reparacion)}</dd><dt>− Preparación</dt><dd>${fmt.cop(v.preparacion)}</dd><dt>− Reserva de riesgo</dt><dd>${fmt.cop(v.reserva)}</dd><dt>− Margen objetivo</dt><dd>${fmt.cop(v.margen_objetivo)}</dd>
            <dt class="bold">= Costo máximo de adquisición</dt><dd class="total">${money(v.costo_maximo)}</dd>
            <dt>Oferta sugerida (${cfg.oferta_inicial_pct} % del máximo, redondeo ${fmt.num(cfg.redondeo)})</dt><dd>${money(v.oferta_sugerida)}</dd></dl>
          <p class="xs muted">Un defecto marcado "se repara" no deprecia: su costo entra en reparaciones. Los porcentajes se ajustan en Configuración › Usados y comisiones.</p>
        </details></div>`;
    activarDinero(c);
    const pintarRes = (val) => {
      const r = $('#v-res', c); if (!r) return;
      const textos = { favorable: ['Negociación favorable', 'la oferta permite alcanzar el margen objetivo'], ajustada: ['Negociación ajustada', 'hay rentabilidad, pero por debajo del objetivo: requiere aprobación'], no_recomendable: ['Negociación no recomendable', val.seguridad_bloquea.length ? 'verificaciones de seguridad que no cumplen' : 'la oferta genera pérdida prevista'], pendiente: ['Pendiente de inspección', `${val.pendientes.length} verificación(es) sin hacer o falta el valor base`] };
      const [t, s] = textos[val.clasificacion];
      r.className = `resultado-neg ${val.clasificacion} mt`; r.innerHTML = `<span class="pt"></span><span class="txt">${t}<span class="sub">${esc(s)}</span></span>${String(badge(CLASIFICACION_USADO, val.clasificacion))}`;
    };
    pintarRes(v);
    const leer = () => ({ oferta_final: $('#v-oferta', c).value ? leerDinero($('#v-oferta', c)) : null, costo_reparacion: $('#v-rep', c).value ? leerDinero($('#v-rep', c)) : null, costo_preparacion: $('#v-prep', c).value ? leerDinero($('#v-prep', c)) : null, reserva_riesgo: $('#v-res-r', c).value ? leerDinero($('#v-res-r', c)) : null, margen_objetivo: $('#v-marg', c).value ? leerDinero($('#v-marg', c)) : null, valor_mercado: $('#v-merc', c).value ? leerDinero($('#v-merc', c)) : null, precio_nuevo_referencia: $('#v-nuevo', c).value ? leerDinero($('#v-nuevo', c)) : null, ...($('#v-exc', c) ? { excepcion_motivo: $('#v-exc', c).value } : {}) });
    const recalc = debounce(async () => { const r = await guardar(leer()); if (r) paso3(c); }, 600);
    ['#v-rep', '#v-prep', '#v-res-r', '#v-marg', '#v-merc', '#v-nuevo', '#v-oferta'].forEach((s) => $(s, c).addEventListener('change', recalc));
    const ex = $('#v-exc', c); if (ex) ex.addEventListener('input', () => guardarDebounce({ excepcion_motivo: ex.value }));
    $$('[data-grado]', c).forEach((b) => b.addEventListener('click', async () => { const r = await guardar({ grado: b.dataset.grado }); if (r) paso3(c); }));
    $('#v-glosario', c).addEventListener('click', () => abrirGlosario('usados'));
  }

  // Paso 4 · Confirmar
  function paso4(c) {
    const v = u.valoracion;
    const metodos = estado.config.metodos_pago || ['efectivo'];
    const puedeAprobar = estado.tiene('usados.aprobar');
    const listo = u.faltantes.length === 0;
    c.innerHTML = `<div class="card"><h2>Lista de verificación</h2><div class="checklist">${[['Marca, modelo e IMEI', !u.faltantes.some((f) => /Marca|IMEI/.test(f))], ['Datos de quien entrega', !u.faltantes.some((f) => /vendedor/.test(f))], ['Inspección completa', v.inspeccion_completa], ['Fotos frontal y trasera', !u.faltantes.some((f) => /Fotograf/.test(f))], ['Valor de mercado y oferta', v.valor_ajustado !== null && v.oferta > 0], ['Seguridad y propiedad', !v.seguridad_bloquea.length]].map(([t, ok]) => `<div>${ok ? `<span class="ok">${icono('check', 18)}</span>` : `<span class="falta">${icono('x', 18)}</span>`}<span>${t}</span></div>`).join('')}</div></div>
      <div class="card"><div class="ficha-cab"><div class="ico">${icono('phone')}</div><div class="grow"><h2 style="margin:0">${esc([u.marca, u.modelo, u.capacidad].filter(Boolean).join(' ') || 'Sin identificar')}</h2><div class="muted small mono">${esc(u.imei1 || u.serial || 'sin IMEI')}</div><div class="muted small">${esc(u.vendedor_nombre || '')}${u.vendedor_contacto ? ' · ' + esc(u.vendedor_contacto) : ''} · atiende ${esc(u.empleado_nombre || '')}</div></div><div class="right"><div class="muted xs">Oferta</div><div class="hero-num">${v.oferta ? fmt.cop(v.oferta) : '—'}</div>${String(badge(CLASIFICACION_USADO, v.clasificacion))}</div></div></div>
      <div class="card"><h2>Aceptación y pago</h2>
        <label class="check"><input type="checkbox" id="c-acepta" ${u.aceptado ? 'checked' : ''}> El cliente acepta la oferta${u.aceptado_en ? ` <span class="muted xs">(${esc(fmt.fechaHora(u.aceptado_en))})</span>` : ''}</label>
        <div class="grid2"><div class="campo"><label>Nombre de quien acepta</label><input id="c-nombre" value="${esc(u.aceptado_nombre || u.vendedor_nombre || '')}"></div>
        <div class="campo"><label>Forma de pago al cliente</label><select id="c-pago"><option value="">Elegir…</option><option value="parte_de_pago" ${u.forma_pago === 'parte_de_pago' ? 'selected' : ''}>Parte de pago de un celular nuevo</option>${metodos.map((m) => `<option value="${esc(m)}" ${u.forma_pago === m ? 'selected' : ''}>${esc(nombreMetodo(m))}</option>`).join('')}</select></div></div>
        ${v.requiere_excepcion ? `<div class="alerta aviso small">Oferta por encima del costo máximo (${fmt.cop(v.costo_maximo)}). ${puedeAprobar ? 'Como empleador puedes aprobarla indicando el motivo.' : 'Se enviará al empleador para su aprobación.'}${u.excepcion_motivo ? ' Motivo: ' + esc(u.excepcion_motivo) : ''}</div>` : ''}
        <div class="row wrap gap mt">
          ${listo && (!v.requiere_excepcion || puedeAprobar) && u.estado !== 'pendiente_aprobacion' ? `<button class="btn primario" id="c-aprobar">${icono('check')} Aprobar compra e ingresar al inventario</button>` : ''}
          ${listo && puedeAprobar && u.estado === 'pendiente_aprobacion' ? `<button class="btn primario" id="c-aprobar">${icono('check')} Aprobar compra</button>` : ''}
          ${listo && v.requiere_excepcion && !puedeAprobar && u.estado === 'borrador' ? `<button class="btn primario" id="c-enviar">${icono('alert')} Enviar al empleador</button>` : ''}
          <button class="btn suave" id="c-guardar">Guardar borrador</button>
          <button class="btn peligro" id="c-anular">Descartar</button>
        </div>
        ${!listo ? `<p class="muted small mt">Faltan: ${esc(u.faltantes.join(' · '))}</p>` : ''}
      </div>`;
    const leer = () => ({ aceptado: $('#c-acepta', c).checked, aceptado_nombre: $('#c-nombre', c).value, forma_pago: $('#c-pago', c).value || null });
    ['#c-acepta', '#c-pago'].forEach((s) => $(s, c).addEventListener('change', async () => { await guardar(leer()); paso4(c); }));
    $('#c-nombre', c).addEventListener('input', () => guardarDebounce(leer()));
    $('#c-guardar', c).addEventListener('click', async () => { await guardar(leer(), { silencioso: false }); navegar('#/usados'); });
    const ba = $('#c-aprobar', c); if (ba) ba.addEventListener('click', async () => {
      await guardar(leer());
      if (!await confirmar(`Se registra la compra por ${fmt.cop(u.valoracion.oferta)}${u.forma_pago === 'parte_de_pago' ? ' como parte de pago (se vincula al cobrar la venta)' : ' con pago en ' + nombreMetodo(u.forma_pago)} y el equipo entra al inventario de usados. ¿Continuar?`, { textoOk: 'Aprobar' })) return;
      try { const r = await api.post(`/api/usados/${id}/aprobar`, {}); toast(`Compra ${r.numero} aprobada`, 'ok'); navegar(`#/usados/${id}`, true); } catch (e) { mostrarError(e); if (e.datos && e.datos.faltantes) { u = await api.get(`/api/usados/${id}`); paso4(c); } }
    });
    const be = $('#c-enviar', c); if (be) be.addEventListener('click', async () => { await guardar(leer()); try { await api.post(`/api/usados/${id}/enviar`); toast('Enviado al empleador para aprobación', 'ok'); navegar(`#/usados/${id}`, true); } catch (e) { mostrarError(e); } });
    $('#c-anular', c).addEventListener('click', async () => { const m = await pedirTexto('Descartar recepción', { etiqueta: 'Motivo', textoOk: 'Descartar' }); if (!m) return; try { await api.post(`/api/usados/${id}/anular`, { motivo: m }); toast('Recepción descartada'); navegar('#/usados', true); } catch (e) { mostrarError(e); } });
  }
  pintar();
}

// ---------- Ficha de recepción ----------
async function ficha(root, id, setTopbar) {
  let u;
  try { [u] = await Promise.all([api.get(`/api/usados/${id}`), cargarCatalogo()]); } catch (e) { mostrarError(e); return navegar('#/usados', true); }
  const abierta = ['borrador', 'pendiente_aprobacion'].includes(u.estado);
  const puedeAprobar = estado.tiene('usados.aprobar');
  const propia = u.empleado_id === estado.usuario.id;
  const acciones = [];
  if (abierta && estado.tiene('usados.registrar') && (propia || puedeAprobar)) acciones.push({ icono: 'edit', titulo: 'Editar', href: `#/usados/${id}/editar` });
  setTopbar({ titulo: `Recepción ${u.numero}`, atras: '#/usados', acciones });
  const v = u.valoracion;
  const money = (x) => (x === null || x === undefined ? '—' : fmt.cop(x));
  const nivelTxt = (g, n) => (g.seguridad ? NIVELES_SEGURIDAD[n] : NIVELES_USADO[n]) || 'No verificado';
  root.innerHTML = `<div class="card"><div class="ficha-cab"><div class="ico">${icono('phone')}</div><div class="grow">
        <div class="row wrap gap">${String(badge(ESTADOS_USADO, u.estado))}${u.estado === 'aprobada' ? String(badge(DESTINOS_USADO, u.destino)) : ''}${abierta ? String(badge(CLASIFICACION_USADO, v.clasificacion)) : ''}${u.excepcion_aprobada_por ? '<span class="badge aviso">Excepción aprobada</span>' : ''}${gradoBadge(u.grado || v.grado)}</div>
        <h2 style="margin:6px 0 2px">${esc([u.marca, u.modelo, u.capacidad, u.color].filter(Boolean).join(' ') || 'Sin identificar')}</h2>
        <div class="muted small mono">${esc([u.imei1 && 'IMEI ' + u.imei1, u.imei2 && 'IMEI2 ' + u.imei2, u.serial && 'S/N ' + u.serial].filter(Boolean).join(' · ') || 'sin IMEI')}</div>
        <div class="muted small">Entrega: ${esc(u.vendedor_nombre || '—')}${u.vendedor_contacto ? ' · ' + esc(u.vendedor_contacto) : ''}${u.vendedor_identificacion ? ' · ' + esc(u.vendedor_identificacion) : ''}</div>
        <div class="muted small">Atiende: ${esc(u.empleado_nombre || '')} · recibido ${esc(fmt.fechaHora(u.fecha_recepcion))}${u.aprobada_en ? ' · aprobado ' + esc(fmt.fechaHora(u.aprobada_en)) + ' por ' + esc(u.aprobada_por_nombre || '') : ''}</div>
      </div><div class="right"><div class="muted xs">${u.estado === 'aprobada' ? 'Pagado / reconocido' : 'Oferta'}</div><div class="hero-num">${money(u.oferta_final ?? v.oferta)}</div><div class="xs muted">${u.forma_pago === 'parte_de_pago' ? (u.venta_numero ? `parte de pago en ${esc(u.venta_numero)}` : 'parte de pago (pendiente de venta)') : u.metodo_pago ? esc(nombreMetodo(u.metodo_pago)) : ''}</div></div></div>
      ${u.rechazo_motivo ? `<div class="alerta peligro mt small">${esc(u.estado === 'rechazada' ? 'Rechazada' : 'Anulada')}: ${esc(u.rechazo_motivo)}</div>` : ''}
      ${u.estado === 'aprobada' ? `<div class="row wrap gap mt">
          ${u.producto_id ? `<a class="btn chico suave" href="#/inventario/${u.producto_id}">${icono('box', 16)} Ver en inventario</a>` : ''}
          ${u.venta_id ? `<a class="btn chico suave" href="#/ventas/${u.venta_id}">${icono('cart', 16)} Venta ${esc(u.venta_numero)}</a>` : ''}
          ${u.venta_reventa_id ? `<a class="btn chico suave" href="#/ventas/${u.venta_reventa_id}">${icono('cart', 16)} Reventa ${esc(u.venta_reventa_numero)} · ${fmt.cop(u.venta_reventa_total)}</a>` : ''}
          ${estado.tiene('usados.registrar') && !['vendido', 'retirado'].includes(u.destino) ? `<select id="fi-destino" class="btn chico suave" style="min-height:32px"><option value="">Cambiar destino…</option>${['pendiente_revision', 'en_reparacion', 'disponible', 'retirado'].filter((d) => d !== u.destino).map((d) => `<option value="${d}">${esc(DESTINOS_USADO[d][0])}</option>`).join('')}</select><button class="btn chico suave" id="fi-costo">${icono('plus', 16)} Registrar costo</button>` : ''}
          ${puedeAprobar && !u.venta_id && !['vendido', 'retirado'].includes(u.destino) ? `<button class="btn chico peligro" id="fi-anular">Anular compra</button>` : ''}
        </div>` : ''}
      ${u.estado === 'pendiente_aprobacion' && puedeAprobar ? `<div class="row wrap gap mt"><button class="btn primario" id="fi-aprobar">${icono('check')} Aprobar compra</button><button class="btn peligro" id="fi-rechazar">Rechazar</button></div>` : ''}
    </div>
    <div class="valor-cards mt">
      <div class="valor-card"><div class="et">${u.estado === 'aprobada' ? 'Costo total de adquisición' : 'Margen esperado'}</div><div class="va">${u.estado === 'aprobada' ? fmt.cop(u.costo_total_adquisicion) : money(v.margen_esperado)}</div><div class="de">${u.estado === 'aprobada' ? `pagado ${fmt.cop(u.oferta_final)} + costos ${fmt.cop(u.costos_posteriores)}${u.costo_actual !== null && u.costo_actual !== undefined ? ' · lote ' + fmt.cop(u.costo_actual) : ''}` : v.requiere_excepcion ? 'oferta por encima del costo máximo' : 'con la oferta actual'}</div></div>
      <div class="valor-card"><div class="et">Costo máximo</div><div class="va">${money(v.costo_maximo)}</div><div class="de">rep. ${fmt.cop(v.reparacion)} · prep. ${fmt.cop(v.preparacion)} · riesgo ${fmt.cop(v.reserva)} · margen ${fmt.cop(v.margen_objetivo)}</div></div>
      <div class="valor-card"><div class="et">Reventa esperada</div><div class="va">${money(v.valor_ajustado)}</div><div class="de">${v.estimado ? 'estimación desde el nuevo' : 'valor de mercado'} · −${v.depreciacion.condicion_pct} % condición</div></div>
    </div>
    <div class="card mt"><div class="row between"><h2 style="margin:0">Inspección</h2><span class="muted xs">${v.inspeccion_completa ? 'completa' : v.pendientes.length + ' pendiente(s)'}</span></div>
      ${catalogo.grupos.map((g) => `<div class="mt"><div class="et-campo mb">${esc(g.nombre)}</div><div class="chips">${g.items.map((it) => { const n = (u.inspeccion || {})[it.clave] || 'no_verificado'; return `<span class="chip ${n}"><i></i>${esc(it.nombre)}: ${esc(nivelTxt(g, n))}${(u.inspeccion_reparar || []).includes(it.clave) ? ' (se repara)' : ''}</span>`; }).join('')}</div></div>`).join('')}
      ${u.bateria_pct !== null && u.bateria_pct !== undefined ? `<div class="muted small mt">Salud de batería: ${u.bateria_pct} %</div>` : ''}
      ${u.observaciones_inspector ? `<p class="small mt">${esc(u.observaciones_inspector)}</p>` : ''}
      ${u.fotos.length ? `<div class="fotos-grid mt">${u.fotos.map((f) => `<a class="foto" href="/api/archivos/${esc(f.ruta)}" target="_blank"><img src="/api/archivos/${esc(f.ruta)}" alt=""><span class="tipo">${esc({ frontal: 'Frontal', trasera: 'Trasera', dano: 'Daño', otra: 'Otra' }[f.tipo] || f.tipo)}</span></a>`).join('')}</div>` : ''}
    </div>
    ${u.costos.length ? `<div class="card"><h2>Costos posteriores</h2><div class="col">${u.costos.map((c) => `<div class="row between small"><span>${esc(fmt.fechaHora(c.fecha))} · ${esc({ reparacion: 'Reparación', preparacion: 'Preparación', otro: 'Otro' }[c.tipo])}${c.descripcion ? ' · ' + esc(c.descripcion) : ''} · ${esc(c.usuario_nombre || '')}</span><b class="num">${fmt.cop(c.valor)}</b></div>`).join('')}</div></div>` : ''}
    <details class="mas card"><summary>Más información</summary>
      <dl class="kv"><dt>Accesorios</dt><dd>${esc(u.accesorios || '—')}</dd><dt>Antigüedad</dt><dd>${u.antiguedad_anios ?? '—'} años</dd><dt>Precio del nuevo</dt><dd>${money(u.precio_nuevo_referencia)}</dd><dt>Valor de mercado registrado</dt><dd>${money(u.valor_mercado)}</dd><dt>Aceptación</dt><dd>${u.aceptado ? `${esc(u.aceptado_nombre || '')} · ${esc(fmt.fechaHora(u.aceptado_en))}` : 'sin aceptar'}</dd>${u.excepcion_motivo ? `<dt>Excepción</dt><dd>${esc(u.excepcion_motivo)}${u.excepcion_aprobada_por_nombre ? ' · aprobó ' + esc(u.excepcion_aprobada_por_nombre) : ''}</dd>` : ''}<dt>Observaciones</dt><dd>${esc(u.observaciones || '—')}</dd><dt>Registró</dt><dd>${esc(u.usuario_nombre || '')}</dd></dl>
      ${estado.tiene('auditoria.ver') ? `<a class="small" href="#/configuracion/auditoria">Ver auditoría</a>` : ''}
    </details>`;
  const recargar = () => ficha(root, id, setTopbar);
  const sd = $('#fi-destino', root); if (sd) sd.addEventListener('change', async () => { if (!sd.value) return; if (sd.value === 'retirado' && !await confirmar('El equipo saldrá del inventario como baja. ¿Continuar?', { peligro: true, textoOk: 'Dar de baja' })) { sd.value = ''; return; } try { await api.post(`/api/usados/${id}/destino`, { destino: sd.value }); toast('Destino actualizado', 'ok'); recargar(); } catch (e) { mostrarError(e); } });
  const bc = $('#fi-costo', root); if (bc) bc.addEventListener('click', () => modal({ titulo: 'Registrar costo del equipo', cuerpo: `<div class="grid2"><div class="campo"><label>Tipo</label><select id="co-tipo"><option value="reparacion">Reparación</option><option value="preparacion">Preparación</option><option value="otro">Otro</option></select></div><div class="campo"><label>Valor *</label><input id="co-valor" data-money></div><div class="campo"><label>Pagado con</label><select id="co-metodo">${(estado.config.metodos_pago || ['efectivo']).map((m) => `<option value="${esc(m)}">${esc(nombreMetodo(m))}</option>`).join('')}</select></div><div class="campo"><label>Descripción</label><input id="co-desc"></div></div><p class="muted xs">Se suma al costo del equipo en inventario y sale de caja.</p>`, acciones: [{ texto: 'Registrar', clase: 'primario', alHacerClic: async ({ modal: m }) => { await api.post(`/api/usados/${id}/costos`, { tipo: $('#co-tipo', m).value, valor: leerDinero($('#co-valor', m)), metodo_pago: $('#co-metodo', m).value, descripcion: $('#co-desc', m).value }); toast('Costo registrado', 'ok'); recargar(); } }] }));
  const ban = $('#fi-anular', root); if (ban) ban.addEventListener('click', async () => { const m = await pedirTexto('Anular compra', { etiqueta: 'Motivo', textoOk: 'Anular' }); if (!m) return; if (!await confirmar('El equipo saldrá del inventario y el pago quedará anulado. ¿Continuar?', { peligro: true, textoOk: 'Anular compra' })) return; try { await api.post(`/api/usados/${id}/anular`, { motivo: m }); toast('Compra anulada'); recargar(); } catch (e) { mostrarError(e); } });
  const bap = $('#fi-aprobar', root); if (bap) bap.addEventListener('click', async () => {
    let motivo = u.excepcion_motivo;
    if (v.requiere_excepcion && !motivo) { motivo = await pedirTexto('Aprobar con excepción', { etiqueta: `La oferta (${fmt.cop(v.oferta)}) supera el costo máximo (${fmt.cop(v.costo_maximo)}). Motivo`, textoOk: 'Aprobar' }); if (!motivo) return; }
    try { await api.post(`/api/usados/${id}/aprobar`, { excepcion_motivo: motivo || undefined }); toast('Compra aprobada', 'ok'); recargar(); } catch (e) { mostrarError(e); }
  });
  const br = $('#fi-rechazar', root); if (br) br.addEventListener('click', async () => { const m = await pedirTexto('Rechazar recepción', { etiqueta: 'Motivo', textoOk: 'Rechazar' }); if (!m) return; try { await api.post(`/api/usados/${id}/rechazar`, { motivo: m }); toast('Recepción rechazada'); recargar(); } catch (e) { mostrarError(e); } });
}
