'use strict';
// Tienda web: la página pública del negocio se alimenta del inventario del panel.
//  - Catálogo público: solo lo publicado (regla general + excepciones por producto en tienda_productos). Nunca expone
//    costos, lotes, proveedores ni existencias exactas por encima de un tope.
//  - Pedidos web: no descuentan inventario; el equipo los confirma y registra la venta en Ventas (el número de la venta
//    queda vinculado al pedido). Cada pedido crea además un cliente potencial (canal "web") para Marketing.
//  - Solicitudes (retoma, crédito, servicio técnico, contacto): entran como clientes potenciales con el detalle en el mensaje.
const crypto = require('node:crypto');
const { transaccion, siguienteNumero, getConfig, setConfig, CONFIG_DEFAULT } = require('../db');
const { err, ahora, hoy, entero, texto, booleano, opcion, slug } = require('../util');
const auditoria = require('./auditoria');
const marketing = require('./marketing');

// ---------------------------------------------------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------------------------------------------------
const PAGOS = ['transferencia', 'contraentrega', 'tienda', 'credito'];
const ENTREGAS = ['recoger', 'local', 'nacional'];
const ESTADOS = ['nuevo', 'confirmado', 'pagado', 'enviado', 'listo', 'entregado', 'cancelado'];
const ESTADOS_FINALES = ['entregado', 'cancelado'];
const TIPOS_SOLICITUD = ['retoma', 'credito', 'servicio', 'contacto', 'aviso_stock'];
const TOPE_DISPONIBLES = 10; // existencias visibles al público: nunca más que esto
const NOMBRES_ESTADO = { nuevo: 'Recibido', confirmado: 'Confirmado', pagado: 'Pago recibido', enviado: 'En camino', listo: 'Listo para recoger', entregado: 'Entregado', cancelado: 'Cancelado' };
const NOMBRES_PAGO = { transferencia: 'Transferencia (Nequi, Daviplata o banco)', contraentrega: 'Pago contra entrega', tienda: 'Pago al recoger en la tienda', credito: 'Crédito SEGY' };
const NOMBRES_ENTREGA = { recoger: 'Recoger en la tienda', local: 'Domicilio local', nacional: 'Envío nacional' };

function ajustes(db) {
  const base = CONFIG_DEFAULT.tienda;
  const c = getConfig(db, 'tienda') || {};
  return {
    ...base, ...c,
    envio: { ...base.envio, ...(c.envio || {}) },
    credito: { ...base.credito, ...(c.credito || {}), planes: Array.isArray(c.credito && c.credito.planes) && c.credito.planes.length ? c.credito.planes : base.credito.planes },
    redes: { ...base.redes, ...(c.redes || {}) },
    mensajes_barra: Array.isArray(c.mensajes_barra) ? c.mensajes_barra : base.mensajes_barra,
    pagos: Array.isArray(c.pagos) && c.pagos.length ? c.pagos.filter((p) => PAGOS.includes(p)) : base.pagos,
  };
}

const digitos = (t) => String(t || '').replace(/\D/g, '');
// Número de WhatsApp en formato internacional (Colombia por defecto): "318 000 0000" → "573180000000".
function whatsappDe(db, cfg = ajustes(db)) {
  const d = digitos(cfg.whatsapp || getConfig(db, 'negocio_telefono'));
  if (!d) return '';
  if (d.length === 10 && d.startsWith('3')) return '57' + d;
  return d;
}

function negocioPublico(db) {
  const cfg = ajustes(db);
  return {
    nombre: getConfig(db, 'negocio_nombre') || 'SEGY',
    ciudad: getConfig(db, 'negocio_ciudad') || '',
    direccion: getConfig(db, 'negocio_direccion') || '',
    telefono: getConfig(db, 'negocio_telefono') || '',
    nit: getConfig(db, 'negocio_nit') || '',
    whatsapp: whatsappDe(db, cfg),
    horario: cfg.horario || '',
    mapa_url: cfg.mapa_url || '',
    redes: cfg.redes,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Catálogo público
// ---------------------------------------------------------------------------------------------------------------------
const GRUPOS = [
  { clave: 'celulares', nombre: 'Celulares', descripcion: 'Equipos nuevos, sellados y con garantía' },
  { clave: 'usados', nombre: 'Usados certificados', descripcion: 'Revisados punto por punto y clasificados por grado' },
  { clave: 'accesorios', nombre: 'Accesorios', descripcion: 'Estuches, vidrios, carga, audio y más' },
  { clave: 'repuestos', nombre: 'Repuestos', descripcion: 'Pantallas, baterías y piezas para reparación' },
];
// Las categorías son editables en el panel: el grupo se deduce del nombre (cualquier categoría nueva cae en Accesorios).
function grupoDeCategoria(nombre) {
  const n = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/usad|reacondicion|seminuev/.test(n)) return 'usados';
  if (/repuest|pieza/.test(n)) return 'repuestos';
  if (/^celular|smartphone|telefono|equipos/.test(n) && !/accesori/.test(n)) return 'celulares';
  return 'accesorios';
}

// Condición de publicación (alias: p = productos, c = categorias, tp = tienda_productos, s = v_stock).
function condicionPublicado(cfg) {
  const porDefecto = cfg.publicar_por_defecto ? 1 : 0;
  const cond = [
    "p.estado IN ('activo','agotado')",
    'p.precio_venta > 0',
    '(c.id IS NULL OR c.activo = 1)',
    `COALESCE(tp.publicado, ${porDefecto}) = 1`,
  ];
  if (!cfg.mostrar_agotados) cond.push('s.stock > 0');
  return cond.join(' AND ');
}

const SELECT_PUBLICO = `SELECT p.id, p.nombre, p.marca, p.modelo_compatible, p.referencia, p.color, p.capacidad, p.descripcion, p.precio_venta, p.estado,
    p.categoria_id, c.nombre AS categoria_nombre, s.stock, tp.destacado, tp.orden, tp.precio_antes, tp.resumen, p.creado_en,
    (SELECT f.id FROM producto_fotos f WHERE f.producto_id = p.id ORDER BY f.principal DESC, f.id LIMIT 1) AS foto_id,
    (SELECT u.grado FROM usados u WHERE u.producto_id = p.id AND u.grado IS NOT NULL ORDER BY u.id DESC LIMIT 1) AS grado_usado
  FROM productos p JOIN v_stock s ON s.producto_id = p.id
  LEFT JOIN categorias c ON c.id = p.categoria_id
  LEFT JOIN tienda_productos tp ON tp.producto_id = p.id`;

const urlFoto = (id) => `/api/publico/tienda/fotos/${id}`;
const slugDe = (p) => `${slug(p.nombre) || 'producto'}-${p.id}`;
const idDeSlug = (s) => { const m = /(\d+)$/.exec(String(s || '')); return m ? Number(m[1]) : null; };

function gradoDe(p) {
  if (p.grado_usado) return p.grado_usado;
  const m = /grado\s*([ABC])\b/i.exec(p.nombre || '');
  return m ? m[1].toUpperCase() : null;
}

function resumenPublico(p) {
  const stock = Math.max(0, Number(p.stock) || 0);
  const grupo = grupoDeCategoria(p.categoria_nombre);
  return {
    id: p.id,
    slug: slugDe(p),
    nombre: p.nombre,
    marca: p.marca || null,
    grupo,
    categoria: p.categoria_id ? { id: p.categoria_id, nombre: p.categoria_nombre } : null,
    precio: p.precio_venta,
    precio_antes: p.precio_antes && p.precio_antes > p.precio_venta ? p.precio_antes : null,
    color: p.color || null,
    capacidad: p.capacidad || null,
    modelo_compatible: p.modelo_compatible || null,
    resumen: p.resumen || null,
    foto: p.foto_id ? urlFoto(p.foto_id) : null,
    disponible: stock > 0,
    disponibles: Math.min(stock, TOPE_DISPONIBLES),
    ultimas_unidades: stock > 0 && stock <= 3,
    destacado: !!p.destacado,
    grado: grupo === 'usados' ? gradoDe(p) : null,
  };
}

function categoriasPublicas(db, cfg = ajustes(db)) {
  const filas = db.prepare(`SELECT c.id, c.nombre, c.orden, COUNT(p.id) AS total
      FROM categorias c
      LEFT JOIN productos p ON (p.categoria_id = c.id)
      LEFT JOIN v_stock s ON s.producto_id = p.id
      LEFT JOIN tienda_productos tp ON tp.producto_id = p.id
      WHERE c.activo = 1 AND (p.id IS NULL OR (${condicionPublicado(cfg)}))
      GROUP BY c.id ORDER BY c.orden, c.nombre`).all();
  return GRUPOS.map((g) => {
    const categorias = filas.filter((c) => grupoDeCategoria(c.nombre) === g.clave && c.total > 0).map((c) => ({ id: c.id, nombre: c.nombre, total: c.total }));
    return { ...g, total: categorias.reduce((a, c) => a + c.total, 0), categorias };
  });
}

const ORDENES = {
  relevancia: 'COALESCE(tp.destacado,0) DESC, (s.stock > 0) DESC, COALESCE(tp.orden,0) DESC, p.precio_venta DESC',
  precio_asc: '(s.stock > 0) DESC, p.precio_venta ASC',
  precio_desc: '(s.stock > 0) DESC, p.precio_venta DESC',
  recientes: 'p.id DESC',
  nombre: 'p.nombre COLLATE NOCASE ASC',
};

function listarPublico(db, f = {}) {
  const cfg = ajustes(db);
  const cond = [condicionPublicado(cfg)];
  const params = [];
  if (f.q) {
    const terminos = String(f.q).trim().slice(0, 80).split(/\s+/).filter(Boolean).slice(0, 5);
    for (const t of terminos) {
      const like = `%${t}%`;
      cond.push('(p.nombre LIKE ? OR p.marca LIKE ? OR p.modelo_compatible LIKE ? OR p.color LIKE ? OR p.capacidad LIKE ? OR c.nombre LIKE ?)');
      params.push(like, like, like, like, like, like);
    }
  }
  if (f.categoria) { cond.push('p.categoria_id = ?'); params.push(entero(f.categoria, 'Categoría', { min: 1 })); }
  if (f.marca) { cond.push('lower(p.marca) = lower(?)'); params.push(String(f.marca).slice(0, 60)); }
  if (f.compatible) { cond.push('lower(p.modelo_compatible) = lower(?)'); params.push(String(f.compatible).slice(0, 80)); }
  if (f.min) { cond.push('p.precio_venta >= ?'); params.push(entero(f.min, 'Precio mínimo', { min: 0 })); }
  if (f.max) { cond.push('p.precio_venta <= ?'); params.push(entero(f.max, 'Precio máximo', { min: 0 })); }
  if (booleano(f.disponible)) cond.push('s.stock > 0');
  if (booleano(f.destacados)) cond.push('tp.destacado = 1');
  if (booleano(f.ofertas)) cond.push('tp.precio_antes > p.precio_venta');
  const where = `WHERE ${cond.join(' AND ')}`;
  let filas = db.prepare(`${SELECT_PUBLICO} ${where} ORDER BY ${ORDENES[f.orden] || ORDENES.relevancia}`).all(...params);
  // El grupo se calcula en JS (depende del nombre de la categoría).
  if (f.grupo) {
    const g = opcion(f.grupo, 'Grupo', GRUPOS.map((x) => x.clave));
    filas = filas.filter((p) => grupoDeCategoria(p.categoria_nombre) === g);
  }
  const total = filas.length;
  const marcas = [...new Set(filas.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const precios = filas.map((p) => p.precio_venta);
  const limite = Math.min(Math.max(Number(f.limite) || 24, 1), 60);
  const pagina = Math.max(Number(f.pagina) || 1, 1);
  const productos = filas.slice((pagina - 1) * limite, pagina * limite).map(resumenPublico);
  return { productos, total, pagina, limite, marcas, rango_precio: precios.length ? { min: Math.min(...precios), max: Math.max(...precios) } : null };
}

function productoPublicadoFila(db, id) {
  const cfg = ajustes(db);
  return db.prepare(`${SELECT_PUBLICO} WHERE p.id = ? AND ${condicionPublicado(cfg)}`).get(id) || null;
}

function obtenerPublico(db, idOSlug) {
  const id = typeof idOSlug === 'number' ? idOSlug : idDeSlug(idOSlug);
  if (!id) throw err.noEncontrado('Producto no encontrado');
  const p = productoPublicadoFila(db, id);
  if (!p) throw err.noEncontrado('Este producto ya no está disponible en la tienda');
  const base = resumenPublico(p);
  const fotos = db.prepare('SELECT id FROM producto_fotos WHERE producto_id = ? ORDER BY principal DESC, id').all(id).map((f) => urlFoto(f.id));
  // Accesorios compatibles: productos cuyo modelo_compatible aparece en el nombre de este equipo
  // ("iPhone 17 Pro Max" → estuches y vidrios marcados "iPhone 17").
  let compatibles = [];
  if (base.grupo === 'celulares' || base.grupo === 'usados') {
    const lista = listarPublico(db, { grupo: 'accesorios', limite: 60 }).productos;
    const nombre = p.nombre.toLowerCase();
    compatibles = lista.filter((a) => a.modelo_compatible && nombre.includes(a.modelo_compatible.toLowerCase())).slice(0, 8);
    if (compatibles.length < 4) {
      const marca = String(p.marca || '').toLowerCase();
      const extra = lista.filter((a) => !compatibles.some((c) => c.id === a.id) && !a.modelo_compatible && (!a.marca || a.marca.toLowerCase() === marca || a.marca.toLowerCase() === 'genérico'));
      compatibles = compatibles.concat(extra.slice(0, 4 - compatibles.length));
    }
  }
  const relacionados = listarPublico(db, { grupo: base.grupo, limite: 13 }).productos.filter((r) => r.id !== id).slice(0, 8);
  return { ...base, descripcion: p.descripcion || null, referencia: p.referencia || null, fotos, compatibles, relacionados };
}

function insignia(db, cfg = ajustes(db)) {
  let id = cfg.producto_insignia_id ? Number(cfg.producto_insignia_id) : null;
  if (!id) {
    const f = db.prepare("SELECT id FROM productos WHERE lower(nombre) LIKE '%iphone 17 pro max%' AND estado IN ('activo','agotado') ORDER BY id LIMIT 1").get();
    id = f ? f.id : null;
  }
  if (!id) return null;
  try { return obtenerPublico(db, id); } catch { return null; }
}

function inicio(db) {
  const cfg = ajustes(db);
  const mkt = getConfig(db, 'marketing') || {};
  let destacados = listarPublico(db, { destacados: 1, limite: 12 }).productos;
  // Sin destacados elegidos: los celulares disponibles más recientes y un par de accesorios, para que la portada nunca quede vacía.
  if (!destacados.length) {
    const cel = listarPublico(db, { grupo: 'celulares', disponible: 1, orden: 'precio_desc', limite: 6 }).productos;
    const acc = listarPublico(db, { grupo: 'accesorios', disponible: 1, limite: 4 }).productos;
    destacados = [...cel, ...acc].slice(0, 8);
  }
  return {
    negocio: negocioPublico(db),
    tienda: {
      activa: cfg.activa !== false,
      mensajes_barra: cfg.mensajes_barra.filter(Boolean).slice(0, 4),
      envio: cfg.envio,
      pagos: cfg.pagos.map((clave) => ({ clave, nombre: NOMBRES_PAGO[clave] })),
      metodos_transferencia: (getConfig(db, 'metodos_pago') || []).filter((m) => ['transferencia', 'nequi', 'daviplata', 'tarjeta'].includes(m)),
      credito: cfg.credito,
    },
    grupos: categoriasPublicas(db, cfg),
    insignia: insignia(db, cfg),
    destacados,
    usados: listarPublico(db, { grupo: 'usados', disponible: 1, limite: 4 }).productos,
    // El token del seguimiento web es público por diseño (va incrustado en la página); vacío = la tienda no envía eventos.
    seguimiento: mkt.token_seguimiento ? { token: mkt.token_seguimiento, endpoint: '/api/publico/marketing/eventos' } : null,
  };
}

function fotoPublica(db, fotoId) {
  const f = db.prepare('SELECT id, producto_id, ruta FROM producto_fotos WHERE id = ?').get(fotoId);
  if (!f || !productoPublicadoFila(db, f.producto_id)) throw err.noEncontrado('Foto no encontrada');
  return f;
}

// ---------------------------------------------------------------------------------------------------------------------
// Límites del formulario público (por IP, memoria del proceso)
// ---------------------------------------------------------------------------------------------------------------------
const cubetas = new Map();
function permite(clave, tope, ventanaMs) {
  const ahoraMs = Date.now();
  const e = cubetas.get(clave);
  if (!e || e.hasta < ahoraMs) {
    cubetas.set(clave, { n: 1, hasta: ahoraMs + ventanaMs });
    if (cubetas.size > 5000) for (const [k, v] of cubetas) if (v.hasta < ahoraMs) cubetas.delete(k);
    return true;
  }
  e.n += 1;
  return e.n <= tope;
}
function limitar(tipo, ip, tope, ventanaMin) {
  if (!permite(`${tipo}:${ip || 'desconocida'}`, tope, ventanaMin * 60000)) {
    const e = err.datos(`Recibimos varios envíos seguidos desde tu conexión. Espera ${ventanaMin} minutos o escríbenos por WhatsApp.`);
    e.status = 429; e.codigo = 'limite';
    throw e;
  }
}
function reiniciarLimites() { cubetas.clear(); }

// Entrada pública: los textos se recortan a su tope en vez de rechazarse.
const corto = (v, max) => { if (v === undefined || v === null) return null; const s = String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max).trim(); return s || null; };
function telefonoValido(t) {
  const d = digitos(t);
  if (d.length < 7 || d.length > 15) throw err.datos('Escribe un número de celular válido para poder contactarte');
  return corto(t, 40);
}
function emailValido(e) {
  const v = corto(e, 160);
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw err.datos('El correo no tiene un formato válido');
  return v;
}
function origenDe(b) {
  return {
    visitante: corto(b.visitante, 80),
    utm_source: corto(b.utm_source, 120),
    utm_medium: corto(b.utm_medium, 120),
    utm_campaign: corto(b.utm_campaign, 120),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Pedidos web
// ---------------------------------------------------------------------------------------------------------------------
const pesos = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO');

function costoEnvio(cfg, entrega, subtotal) {
  if (entrega === 'recoger') return { envio: 0, por_confirmar: false };
  const e = cfg.envio || {};
  if (e.gratis_desde && subtotal >= Number(e.gratis_desde)) return { envio: 0, por_confirmar: false };
  const costo = entrega === 'local' ? e.local_costo : e.nacional_costo;
  if (costo === null || costo === undefined || costo === '') return { envio: 0, por_confirmar: true };
  return { envio: Math.max(0, Math.round(Number(costo) || 0)), por_confirmar: false };
}

function crearPedido(db, b, { ip } = {}) {
  const cfg = ajustes(db);
  if (cfg.activa === false) throw err.datos('La tienda en línea no está recibiendo pedidos en este momento. Escríbenos por WhatsApp.');
  if (!b || typeof b !== 'object') throw err.datos('Pedido inválido');
  if (b.acepta_datos !== true) throw err.datos('Para tomar tu pedido necesitamos tu autorización de tratamiento de datos');
  const cli = b.cliente || {};
  const nombre = corto(cli.nombre, 160);
  if (!nombre || nombre.length < 3) throw err.datos('Escribe tu nombre completo');
  const telefono = telefonoValido(cli.telefono);
  const email = emailValido(cli.email);
  const documento = corto(cli.documento, 40);

  const ent = b.entrega || {};
  const entrega = opcion(ent.tipo || 'recoger', 'Entrega', ENTREGAS);
  if (entrega === 'nacional' && !cfg.envio.nacional) throw err.datos('Por ahora no hacemos envíos fuera de la ciudad');
  const ciudad = corto(ent.ciudad, 80);
  const direccion = corto(ent.direccion, 200);
  const barrio = corto(ent.barrio, 80);
  if (entrega !== 'recoger' && !direccion) throw err.datos('Escribe la dirección de entrega');
  if (entrega === 'nacional' && !ciudad) throw err.datos('Escribe la ciudad de entrega');

  const pago = opcion(b.pago || 'transferencia', 'Forma de pago', cfg.pagos);
  if (pago === 'contraentrega' && entrega !== 'local') throw err.datos('El pago contra entrega solo aplica para domicilios en la ciudad');
  if (pago === 'tienda' && entrega !== 'recoger') throw err.datos('El pago en la tienda aplica cuando recoges el pedido');
  let creditoCuotas = null;
  if (pago === 'credito') {
    if (!cfg.credito.activo) throw err.datos('El crédito no está disponible en este momento');
    creditoCuotas = entero(b.credito_cuotas, 'Número de cuotas', { min: 1, max: 48 });
    if (!cfg.credito.planes.some((p) => Number(p.cuotas) === creditoCuotas)) throw err.datos('Elige uno de los planes de cuotas disponibles');
  }

  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) throw err.datos('Tu carrito está vacío');
  if (items.length > 20) throw err.datos('Un pedido web admite hasta 20 productos distintos; para compras mayores escríbenos');
  const lineas = [];
  for (const it of items) {
    const productoId = entero(it && it.producto_id, 'Producto', { min: 1 });
    const cantidad = entero(it && it.cantidad, 'Cantidad', { min: 1, max: 10 });
    const p = productoPublicadoFila(db, productoId);
    if (!p) throw err.datos('Uno de los productos del carrito ya no está disponible. Revisa tu carrito.', { producto_id: productoId });
    if ((Number(p.stock) || 0) < cantidad) throw err.datos(`De "${p.nombre}" solo quedan ${Math.max(0, Number(p.stock) || 0)} unidades disponibles`, { producto_id: productoId, disponibles: Math.min(Math.max(0, Number(p.stock) || 0), TOPE_DISPONIBLES) });
    const existente = lineas.find((l) => l.producto_id === productoId);
    if (existente) { existente.cantidad += cantidad; existente.total = existente.cantidad * existente.precio; continue; }
    lineas.push({ producto_id: productoId, nombre: p.nombre, precio: p.precio_venta, cantidad, total: p.precio_venta * cantidad });
  }
  const subtotal = lineas.reduce((a, l) => a + l.total, 0);
  const { envio, por_confirmar: envioPorConfirmar } = costoEnvio(cfg, entrega, subtotal);
  const total = subtotal + envio;
  const notas = corto(b.notas, 1000);
  const retoma = b.retoma && typeof b.retoma === 'object' ? corto([b.retoma.marca, b.retoma.modelo, b.retoma.capacidad, b.retoma.estado].filter(Boolean).join(' · '), 300) : null;
  const origen = origenDe(b);

  limitar('pedido', ip, 5, 10);
  const token = crypto.randomBytes(16).toString('hex');
  const fecha = ahora();
  return transaccion(db, () => {
    const numero = siguienteNumero(db, 'tienda_pedido', 'TW');
    const historial = [{ fecha, estado: 'nuevo', nota: 'Pedido recibido desde la página web' }];
    const r = db.prepare(`INSERT INTO tienda_pedidos(numero, token, fecha, estado, nombre, telefono, email, documento, entrega, ciudad, direccion, barrio, pago, credito_cuotas, subtotal, envio, envio_por_confirmar, total, notas, retoma, visitante, utm_source, utm_medium, utm_campaign, historial, actualizado_en)
                          VALUES (?,?,?,'nuevo',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(numero, token, fecha, nombre, telefono, email, documento, entrega, ciudad, direccion, barrio, pago, creditoCuotas, subtotal, envio, envioPorConfirmar ? 1 : 0, total, notas, retoma, origen.visitante, origen.utm_source, origen.utm_medium, origen.utm_campaign, JSON.stringify(historial), fecha);
    const pedidoId = Number(r.lastInsertRowid);
    const ins = db.prepare('INSERT INTO tienda_pedido_items(pedido_id, producto_id, nombre, precio, cantidad, total) VALUES (?,?,?,?,?,?)');
    for (const l of lineas) ins.run(pedidoId, l.producto_id, l.nombre, l.precio, l.cantidad, l.total);

    // Cliente potencial para Marketing (atribución por UTM, seguimiento del equipo). Nunca tumba el pedido.
    let leadId = null; let campanaId = null;
    try {
      const resumen = lineas.map((l) => `${l.cantidad} × ${l.nombre}`).join(', ');
      const lead = marketing.crearLead(db, {
        nombre, telefono, email, canal: 'web',
        mensaje: `Pedido web ${numero}: ${resumen}. Total ${pesos(total)}${envioPorConfirmar ? ' + envío por confirmar' : ''}. Pago: ${NOMBRES_PAGO[pago]}${creditoCuotas ? ` (${creditoCuotas} cuotas)` : ''}. Entrega: ${NOMBRES_ENTREGA[entrega]}.${retoma ? ` Retoma: ${retoma}.` : ''}`,
        producto_id: lineas[0].producto_id, producto_texto: lineas[0].nombre,
        ...origen,
      }, null, { auditar: false, canalesExtra: ['web'] });
      leadId = lead.id; campanaId = lead.campana_id || null;
    } catch (e) { console.error('[tienda] cliente potencial del pedido no creado:', e.message); }
    db.prepare('UPDATE tienda_pedidos SET lead_id = ?, campana_id = ? WHERE id = ?').run(leadId, campanaId, pedidoId);
    auditoria.registrar(db, null, 'pedido_web', 'tienda_pedido', pedidoId, { numero, total, items: lineas.length }, ip);
    return { numero, token, total, subtotal, envio, envio_por_confirmar: envioPorConfirmar, estado: 'nuevo' };
  });
}

// Lo que el cliente ve de su pedido con el enlace privado (sin notas internas ni datos de contacto completos).
function pedidoPublico(db, token) {
  const t = String(token || '');
  if (!/^[a-f0-9]{32}$/.test(t)) throw err.noEncontrado('Pedido no encontrado');
  const p = db.prepare('SELECT * FROM tienda_pedidos WHERE token = ?').get(t);
  if (!p) throw err.noEncontrado('Pedido no encontrado');
  const items = db.prepare('SELECT producto_id, nombre, precio, cantidad, total FROM tienda_pedido_items WHERE pedido_id = ? ORDER BY id').all(p.id);
  let historial = [];
  try { historial = JSON.parse(p.historial || '[]').map((h) => ({ fecha: h.fecha, estado: h.estado, estado_texto: NOMBRES_ESTADO[h.estado] || h.estado })); } catch { historial = []; }
  return {
    numero: p.numero, fecha: p.fecha, estado: p.estado, estado_texto: NOMBRES_ESTADO[p.estado] || p.estado,
    nombre: String(p.nombre || '').split(/\s+/)[0],
    entrega: p.entrega, entrega_texto: NOMBRES_ENTREGA[p.entrega], ciudad: p.ciudad,
    pago: p.pago, pago_texto: NOMBRES_PAGO[p.pago], credito_cuotas: p.credito_cuotas,
    items: items.map((i) => ({ ...i, slug: `${slug(i.nombre) || 'producto'}-${i.producto_id}` })),
    subtotal: p.subtotal, envio: p.envio, envio_por_confirmar: !!p.envio_por_confirmar, total: p.total,
    historial,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Solicitudes: retoma, crédito, servicio técnico, contacto, aviso de disponibilidad
// ---------------------------------------------------------------------------------------------------------------------
const ETIQUETAS_SOLICITUD = { retoma: 'Retoma', credito: 'Crédito', servicio: 'Servicio técnico', contacto: 'Contacto', aviso_stock: 'Avisar disponibilidad' };
function crearSolicitud(db, b, { ip } = {}) {
  if (!b || typeof b !== 'object') throw err.datos('Solicitud inválida');
  if (b.acepta_datos !== true) throw err.datos('Necesitamos tu autorización de tratamiento de datos para responderte');
  const tipo = opcion(b.tipo, 'Tipo de solicitud', TIPOS_SOLICITUD);
  const nombre = corto(b.nombre, 160);
  if (!nombre || nombre.length < 2) throw err.datos('Escribe tu nombre');
  const telefono = telefonoValido(b.telefono);
  const email = emailValido(b.email);
  const detalle = b.datos && typeof b.datos === 'object' && !Array.isArray(b.datos)
    ? Object.entries(b.datos).slice(0, 20).map(([k, v]) => [corto(k, 40), corto(Array.isArray(v) ? v.join(', ') : v, 200)]).filter(([k, v]) => k && v)
    : [];
  const mensajeLibre = corto(b.mensaje, 1500);
  let productoId = null; let productoTexto = corto(b.producto_texto, 200);
  if (b.producto_id) {
    const p = productoPublicadoFila(db, entero(b.producto_id, 'Producto', { min: 1 }));
    if (p) { productoId = p.id; productoTexto = p.nombre; }
  }
  const mensaje = [
    `[${ETIQUETAS_SOLICITUD[tipo]} · página web]`,
    detalle.map(([k, v]) => `${k}: ${v}`).join(' · '),
    mensajeLibre,
  ].filter(Boolean).join('\n').slice(0, 2000);
  limitar('solicitud', ip, 6, 5);
  const lead = marketing.crearLead(db, { nombre, telefono, email, canal: 'web', mensaje, producto_id: productoId, producto_texto: productoTexto, ...origenDe(b) }, null, { auditar: false, canalesExtra: ['web'] });
  auditoria.registrar(db, null, 'solicitud_web', 'lead', lead.id, { tipo }, ip);
  return { ok: true, tipo };
}

// ---------------------------------------------------------------------------------------------------------------------
// Panel: pedidos
// ---------------------------------------------------------------------------------------------------------------------
function listarPedidos(db, { estado, q, limite = 100 } = {}) {
  const cond = []; const params = [];
  if (estado === 'abiertos') cond.push("p.estado NOT IN ('entregado','cancelado')");
  else if (estado && estado !== 'todos') { cond.push('p.estado = ?'); params.push(opcion(estado, 'Estado', ESTADOS)); }
  if (q) { const like = `%${String(q).trim().slice(0, 80)}%`; cond.push('(p.numero LIKE ? OR p.nombre LIKE ? OR p.telefono LIKE ? OR p.email LIKE ?)'); params.push(like, like, like, like); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const filas = db.prepare(`SELECT p.id, p.numero, p.fecha, p.estado, p.nombre, p.telefono, p.entrega, p.ciudad, p.pago, p.credito_cuotas, p.total, p.envio_por_confirmar, p.venta_numero,
      (SELECT COUNT(*) FROM tienda_pedido_items i WHERE i.pedido_id = p.id) AS lineas,
      (SELECT group_concat(i.cantidad || ' × ' || i.nombre, ', ') FROM tienda_pedido_items i WHERE i.pedido_id = p.id) AS resumen
      FROM tienda_pedidos p ${where} ORDER BY p.id DESC LIMIT ?`).all(...params, Math.min(Number(limite) || 100, 500));
  return { pedidos: filas, conteo: resumen(db).por_estado };
}

function obtenerPedido(db, id) {
  const p = db.prepare(`SELECT p.*, c.nombre AS campana_nombre, l.estado AS lead_estado FROM tienda_pedidos p
      LEFT JOIN campanas c ON c.id = p.campana_id LEFT JOIN marketing_leads l ON l.id = p.lead_id WHERE p.id = ?`).get(id);
  if (!p) throw err.noEncontrado('Pedido no encontrado');
  p.items = db.prepare(`SELECT i.*, s.stock FROM tienda_pedido_items i LEFT JOIN v_stock s ON s.producto_id = i.producto_id WHERE i.pedido_id = ? ORDER BY i.id`).all(id);
  try { p.historial = JSON.parse(p.historial || '[]'); } catch { p.historial = []; }
  p.envio_por_confirmar = !!p.envio_por_confirmar;
  p.estado_texto = NOMBRES_ESTADO[p.estado];
  p.pago_texto = NOMBRES_PAGO[p.pago];
  p.entrega_texto = NOMBRES_ENTREGA[p.entrega];
  // Enlace privado de seguimiento para compartir con el cliente (solo si se configuró la dirección de la tienda).
  const base = ajustes(db).url_tienda;
  p.enlace_seguimiento = base ? `${base}/pedido/${p.token}` : null;
  delete p.token;
  return p;
}

function cambiarEstadoPedido(db, id, estado, nota, usuario) {
  const nuevo = opcion(estado, 'Estado', ESTADOS);
  return transaccion(db, () => {
    const p = db.prepare('SELECT id, numero, estado, historial FROM tienda_pedidos WHERE id = ?').get(id);
    if (!p) throw err.noEncontrado('Pedido no encontrado');
    if (ESTADOS_FINALES.includes(p.estado)) throw err.conflicto(`El pedido ya está ${NOMBRES_ESTADO[p.estado].toLowerCase()}; no se puede cambiar`);
    if (p.estado === nuevo) return obtenerPedido(db, id);
    const textoNota = texto(nota, 'Nota', { opcional: true, max: 500 });
    if (nuevo === 'cancelado' && !textoNota) throw err.datos('Escribe el motivo de la cancelación');
    let historial = [];
    try { historial = JSON.parse(p.historial || '[]'); } catch { historial = []; }
    historial.push({ fecha: ahora(), estado: nuevo, nota: textoNota, usuario: usuario ? usuario.nombre : null });
    db.prepare('UPDATE tienda_pedidos SET estado = ?, historial = ?, actualizado_en = ? WHERE id = ?').run(nuevo, JSON.stringify(historial), ahora(), id);
    auditoria.registrar(db, usuario, 'estado_pedido_web', 'tienda_pedido', id, { numero: p.numero, antes: p.estado, despues: nuevo, nota: textoNota });
    return obtenerPedido(db, id);
  });
}

function actualizarPedido(db, id, datos, usuario) {
  const p = db.prepare('SELECT id, numero, notas_internas, venta_numero FROM tienda_pedidos WHERE id = ?').get(id);
  if (!p) throw err.noEncontrado('Pedido no encontrado');
  const notas = datos.notas_internas === undefined ? p.notas_internas : texto(datos.notas_internas, 'Notas internas', { opcional: true, max: 2000 });
  let venta = datos.venta_numero === undefined ? p.venta_numero : texto(datos.venta_numero, 'Número de venta', { opcional: true, max: 30 });
  if (venta) {
    const v = db.prepare('SELECT numero FROM ventas WHERE upper(numero) = upper(?)').get(venta);
    if (!v) throw err.noEncontrado(`No existe la venta ${venta}. Regístrala primero en Ventas y luego vincúlala aquí.`);
    venta = v.numero;
  }
  db.prepare('UPDATE tienda_pedidos SET notas_internas = ?, venta_numero = ?, actualizado_en = ? WHERE id = ?').run(notas, venta, ahora(), id);
  auditoria.registrar(db, usuario, 'editar_pedido_web', 'tienda_pedido', id, { numero: p.numero, venta_numero: venta });
  return obtenerPedido(db, id);
}

function resumen(db) {
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  for (const f of db.prepare('SELECT estado, COUNT(*) n FROM tienda_pedidos GROUP BY estado').all()) porEstado[f.estado] = f.n;
  const h = hoy();
  const dia = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) total FROM tienda_pedidos WHERE fecha >= ? AND estado <> 'cancelado'").get(h + ' 00:00:00');
  const abiertos = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) total FROM tienda_pedidos WHERE estado NOT IN ('entregado','cancelado')").get();
  return { por_estado: porEstado, hoy: dia, abiertos, nuevos: porEstado.nuevo };
}

// ---------------------------------------------------------------------------------------------------------------------
// Panel: productos en la web
// ---------------------------------------------------------------------------------------------------------------------
function listarProductosWeb(db, { q, categoria_id, filtro } = {}) {
  const cfg = ajustes(db);
  const cond = ["p.estado <> 'inactivo'"]; const params = [];
  if (q) { const like = `%${String(q).trim().slice(0, 80)}%`; cond.push('(p.nombre LIKE ? OR p.marca LIKE ? OR p.sku LIKE ? OR p.modelo_compatible LIKE ?)'); params.push(like, like, like, like); }
  if (categoria_id) { cond.push('p.categoria_id = ?'); params.push(entero(categoria_id, 'Categoría', { min: 1 })); }
  const filas = db.prepare(`SELECT p.id, p.nombre, p.marca, p.sku, p.estado, p.precio_venta, p.categoria_id, c.nombre AS categoria_nombre, c.activo AS categoria_activa, s.stock,
        tp.publicado, tp.destacado, tp.orden, tp.precio_antes, tp.resumen,
        (SELECT COUNT(*) FROM producto_fotos f WHERE f.producto_id = p.id) AS fotos,
        (SELECT f.ruta FROM producto_fotos f WHERE f.producto_id = p.id ORDER BY f.principal DESC, f.id LIMIT 1) AS foto
      FROM productos p JOIN v_stock s ON s.producto_id = p.id LEFT JOIN categorias c ON c.id = p.categoria_id LEFT JOIN tienda_productos tp ON tp.producto_id = p.id
      WHERE ${cond.join(' AND ')} ORDER BY c.orden, p.nombre COLLATE NOCASE`).all(...params);
  const salida = filas.map((f) => {
    const elegido = f.publicado === null || f.publicado === undefined ? !!cfg.publicar_por_defecto : !!f.publicado;
    const motivos = [];
    if (!(f.precio_venta > 0)) motivos.push('sin precio de venta');
    if (f.categoria_activa === 0) motivos.push('categoría inactiva');
    if (!['activo', 'agotado'].includes(f.estado)) motivos.push(`estado ${f.estado}`);
    if (!cfg.mostrar_agotados && !(f.stock > 0)) motivos.push('agotado');
    return {
      ...f, grupo: grupoDeCategoria(f.categoria_nombre), slug: slugDe(f),
      publicado: elegido, publicado_explicito: f.publicado !== null && f.publicado !== undefined,
      destacado: !!f.destacado, visible: elegido && motivos.length === 0, motivos_oculto: motivos,
    };
  });
  const filtradas = filtro === 'visibles' ? salida.filter((p) => p.visible) : filtro === 'ocultos' ? salida.filter((p) => !p.visible) : filtro === 'destacados' ? salida.filter((p) => p.destacado) : filtro === 'sin_fotos' ? salida.filter((p) => !p.fotos) : salida;
  return { productos: filtradas, totales: { todos: salida.length, visibles: salida.filter((p) => p.visible).length, destacados: salida.filter((p) => p.destacado).length, sin_fotos: salida.filter((p) => !p.fotos).length } };
}

function guardarProductoWeb(db, id, datos, usuario) {
  const p = db.prepare('SELECT id, nombre, precio_venta FROM productos WHERE id = ?').get(id);
  if (!p) throw err.noEncontrado('Producto no existe');
  const cfg = ajustes(db);
  const actual = db.prepare('SELECT * FROM tienda_productos WHERE producto_id = ?').get(id) || { publicado: cfg.publicar_por_defecto ? 1 : 0, destacado: 0, orden: 0, precio_antes: null, resumen: null };
  const d = {
    publicado: datos.publicado === undefined ? actual.publicado : (booleano(datos.publicado) ? 1 : 0),
    destacado: datos.destacado === undefined ? actual.destacado : (booleano(datos.destacado) ? 1 : 0),
    orden: datos.orden === undefined ? actual.orden : entero(datos.orden, 'Orden', { min: -999, max: 999, opcional: true, defecto: 0 }),
    precio_antes: datos.precio_antes === undefined ? actual.precio_antes : entero(datos.precio_antes, 'Precio antes', { min: 0, opcional: true }),
    resumen: datos.resumen === undefined ? actual.resumen : texto(datos.resumen, 'Resumen', { opcional: true, max: 280 }),
  };
  if (d.precio_antes && d.precio_antes <= p.precio_venta) throw err.datos(`El precio "antes" debe ser mayor que el precio actual (${pesos(p.precio_venta)}) para mostrarse como oferta`);
  db.prepare(`INSERT INTO tienda_productos(producto_id, publicado, destacado, orden, precio_antes, resumen, actualizado_en) VALUES (?,?,?,?,?,?,?)
              ON CONFLICT(producto_id) DO UPDATE SET publicado = excluded.publicado, destacado = excluded.destacado, orden = excluded.orden, precio_antes = excluded.precio_antes, resumen = excluded.resumen, actualizado_en = excluded.actualizado_en`)
    .run(id, d.publicado, d.destacado, d.orden, d.precio_antes || null, d.resumen, ahora());
  auditoria.registrar(db, usuario, 'producto_web', 'producto', id, { nombre: p.nombre, ...d });
  return listarProductosWeb(db, {}).productos.find((x) => x.id === id);
}

// ---------------------------------------------------------------------------------------------------------------------
// Panel: ajustes
// ---------------------------------------------------------------------------------------------------------------------
const montoONulo = (v, nombre) => (v === null || v === undefined || v === '' ? null : entero(v, nombre, { min: 0, max: 100000000 }));
const url = (v, nombre) => {
  const t = texto(v, nombre, { opcional: true, max: 300 });
  if (t && !/^https:\/\/[^\s]+$/i.test(t)) throw err.datos(`${nombre}: usa una dirección completa que empiece por https://`);
  return t || '';
};
function guardarAjustes(db, datos, usuario) {
  const actual = ajustes(db);
  const b = datos || {};
  const nuevo = { ...actual };
  if (b.activa !== undefined) nuevo.activa = booleano(b.activa);
  if (b.publicar_por_defecto !== undefined) nuevo.publicar_por_defecto = booleano(b.publicar_por_defecto);
  if (b.mostrar_agotados !== undefined) nuevo.mostrar_agotados = booleano(b.mostrar_agotados);
  if (b.whatsapp !== undefined) { const w = digitos(b.whatsapp); if (w && (w.length < 10 || w.length > 15)) throw err.datos('El WhatsApp debe tener entre 10 y 15 dígitos (con indicativo de país, p. ej. 573180000000)'); nuevo.whatsapp = w; }
  if (b.url_tienda !== undefined) {
    const u = texto(b.url_tienda, 'Dirección de la tienda', { opcional: true, max: 200 });
    if (u && !/^https?:\/\/[^\s/]+$/i.test(u.replace(/\/+$/, ''))) throw err.datos('Dirección de la tienda: usa solo el dominio, p. ej. https://segy.com.co');
    nuevo.url_tienda = u ? u.replace(/\/+$/, '') : '';
  }
  if (b.horario !== undefined) nuevo.horario = texto(b.horario, 'Horario', { opcional: true, max: 200 }) || '';
  if (b.mapa_url !== undefined) nuevo.mapa_url = url(b.mapa_url, 'Enlace del mapa');
  if (b.mensajes_barra !== undefined) {
    const lista = Array.isArray(b.mensajes_barra) ? b.mensajes_barra : String(b.mensajes_barra || '').split('\n');
    nuevo.mensajes_barra = lista.map((m) => String(m || '').trim().slice(0, 90)).filter(Boolean).slice(0, 4);
  }
  if (b.envio !== undefined) {
    const e = b.envio || {};
    nuevo.envio = {
      local_nombre: texto(e.local_nombre ?? actual.envio.local_nombre, 'Nombre del domicilio local', { max: 60 }),
      local_costo: montoONulo(e.local_costo, 'Costo del domicilio local'),
      nacional: e.nacional === undefined ? actual.envio.nacional : booleano(e.nacional),
      nacional_costo: montoONulo(e.nacional_costo, 'Costo del envío nacional'),
      gratis_desde: montoONulo(e.gratis_desde, 'Envío gratis desde'),
    };
  }
  if (b.pagos !== undefined) {
    const pagos = (Array.isArray(b.pagos) ? b.pagos : []).filter((p) => PAGOS.includes(p));
    if (!pagos.length) throw err.datos('Deja al menos una forma de pago activa');
    nuevo.pagos = pagos;
  }
  if (b.credito !== undefined) {
    const c = b.credito || {};
    const planes = (Array.isArray(c.planes) ? c.planes : actual.credito.planes).map((p) => ({ cuotas: entero(p.cuotas, 'Cuotas del plan', { min: 1, max: 48 }), interes_pct: Number(p.interes_pct) >= 0 && Number(p.interes_pct) <= 100 ? Math.round(Number(p.interes_pct) * 100) / 100 : 0 }))
      .filter((p, i, arr) => arr.findIndex((x) => x.cuotas === p.cuotas) === i).sort((a, b2) => a.cuotas - b2.cuotas).slice(0, 8);
    if (!planes.length) throw err.datos('Agrega al menos un plan de cuotas');
    nuevo.credito = { activo: c.activo === undefined ? actual.credito.activo : booleano(c.activo), cuota_inicial_min_pct: entero(c.cuota_inicial_min_pct ?? actual.credito.cuota_inicial_min_pct, 'Cuota inicial mínima', { min: 0, max: 90 }), planes };
  }
  if (b.producto_insignia_id !== undefined) {
    const idI = b.producto_insignia_id ? entero(b.producto_insignia_id, 'Producto de la portada', { min: 1 }) : null;
    if (idI && !db.prepare('SELECT id FROM productos WHERE id = ?').get(idI)) throw err.noEncontrado('El producto de la portada no existe');
    nuevo.producto_insignia_id = idI;
  }
  if (b.redes !== undefined) {
    const r = b.redes || {};
    nuevo.redes = { instagram: url(r.instagram, 'Instagram'), facebook: url(r.facebook, 'Facebook'), tiktok: url(r.tiktok, 'TikTok') };
  }
  setConfig(db, 'tienda', nuevo);
  auditoria.registrar(db, usuario, 'ajustes_tienda', 'configuracion', 'tienda', null);
  return ajustesPanel(db);
}
function ajustesPanel(db) {
  const cfg = ajustes(db);
  const ins = insignia(db, cfg);
  return { ...cfg, whatsapp_efectivo: whatsappDe(db, cfg), insignia: ins ? { id: ins.id, nombre: ins.nombre } : null, seguimiento_activo: !!(getConfig(db, 'marketing') || {}).token_seguimiento };
}

module.exports = {
  GRUPOS, ESTADOS, PAGOS, ENTREGAS, TIPOS_SOLICITUD, NOMBRES_ESTADO, NOMBRES_PAGO, NOMBRES_ENTREGA,
  ajustes, ajustesPanel, guardarAjustes, grupoDeCategoria, idDeSlug,
  inicio, listarPublico, obtenerPublico, fotoPublica, crearPedido, pedidoPublico, crearSolicitud, reiniciarLimites,
  listarPedidos, obtenerPedido, cambiarEstadoPedido, actualizarPedido, resumen, listarProductosWeb, guardarProductoWeb,
};
