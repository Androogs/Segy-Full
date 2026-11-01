'use strict';
// Recepción, inspección, valoración y compra de celulares usados (retomas).
// Flujo: borrador (se guarda en cualquier paso) → pendiente_aprobacion → aprobada (entra al inventario de usados como lote con el
// costo pagado) | rechazada | anulada. La valoración distingue: valor de mercado (reventa esperada), costo máximo de adquisición y
// oferta al cliente. "No verificado" nunca cuenta como buen estado. Todo porcentaje y costo es configurable.
const { transaccion, siguienteNumero, getConfig, CONFIG_DEFAULT } = require('../db');
const { err, ahora, hoy, entero, texto, decimal, opcion } = require('../util');
const { tiene } = require('../permisos');
const auditoria = require('./auditoria');
const inventario = require('./inventario');
const archivos = require('./archivos');
const caja = require('./caja');

const NIVELES = ['excelente', 'bueno', 'regular', 'deficiente', 'no_funciona', 'no_verificado'];
// Grupos e ítems de la inspección. Los de seguridad no deprecian: bloquean la compra si no se cumplen.
const GRUPOS = [
  { clave: 'pantalla', nombre: 'Pantalla', items: [['pantalla_estado', 'Estado de la pantalla', true], ['pantalla_rayones', 'Rayones, manchas, líneas o píxeles', true], ['pantalla_tactil', 'Táctil', true], ['pantalla_vidrio', 'Vidrio y tapa trasera', true]] },
  { clave: 'bateria', nombre: 'Batería y carga', items: [['bateria_salud', 'Salud de la batería', true], ['bateria_autonomia', 'Autonomía y carga', true]] },
  { clave: 'funcionamiento', nombre: 'Funcionamiento', items: [['func_botones', 'Botones y puertos', true], ['func_audio', 'Altavoces, micrófono y vibración', true], ['func_camaras', 'Cámaras frontal y traseras', true], ['func_conectividad', 'Wi-Fi, Bluetooth y red móvil', true], ['func_sensores', 'Sensores y biometría', false]] },
  { clave: 'fisico', nombre: 'Estado físico', items: [['fis_carcasa', 'Carcasa y marco', true], ['fis_golpes', 'Golpes, deformaciones o fisuras', true], ['fis_humedad', 'Humedad o corrosión', true], ['fis_reparaciones', 'Reparaciones previas conocidas', false], ['fis_conservacion', 'Conservación general', true]] },
  { clave: 'seguridad', nombre: 'Seguridad y propiedad', seguridad: true, items: [['seg_imei', 'El IMEI coincide con el equipo', true], ['seg_bloqueo', 'Sin bloqueo de red ni reporte', true], ['seg_cuentas', 'Desvinculado de cuentas (iCloud / Google)', true], ['seg_propiedad', 'Declaración de propiedad legítima', true], ['seg_procedencia', 'Verificación de procedencia', false]] },
];
const ITEMS = GRUPOS.flatMap((g) => g.items.map(([clave, nombre, obligatorio]) => ({ clave, nombre, obligatorio, grupo: g.clave, seguridad: !!g.seguridad })));
const ITEM = Object.fromEntries(ITEMS.map((i) => [i.clave, i]));
const DESTINOS = ['pendiente_revision', 'en_reparacion', 'disponible', 'vendido', 'retirado'];

function configValoracion(db) {
  const base = CONFIG_DEFAULT.valoracion_usados;
  const c = getConfig(db, 'valoracion_usados') || {};
  return { ...base, ...c, depreciacion_nivel: { ...base.depreciacion_nivel, ...(c.depreciacion_nivel || {}) }, peso_grupo: { ...base.peso_grupo, ...(c.peso_grupo || {}) } };
}
// Grado comercial: A = como nuevo, B = uso normal, C = desgaste visible o defectos. Se sugiere por la depreciación por condición.
const GRADOS = ['A', 'B', 'C'];
function gradoPorDepreciacion(cfg, pct) { return pct <= (cfg.grado_a_max_pct ?? 10) ? 'A' : pct <= (cfg.grado_b_max_pct ?? 25) ? 'B' : 'C'; }
// Recepciones guardadas antes de existir el grado (2026-10-12): se deduce de la depreciación ya calculada, sin recalcular nada más.
function gradoDe(cfg, grado, v) { return grado || (v && v.grado) || (v && v.depreciacion ? gradoPorDepreciacion(cfg, v.depreciacion.condicion_pct) : null); }
const redondear = (v, r) => (r > 0 ? Math.floor(v / r) * r : Math.round(v));

// ---------- Valoración (función pura: misma lógica en pruebas y en la API) ----------
function valorar(cfg, d = {}) {
  const insp = d.inspeccion || {};
  const reparar = new Set(Array.isArray(d.inspeccion_reparar) ? d.inspeccion_reparar : []);
  const orden = (n) => NIVELES.indexOf(n);
  const grupos = {};
  let depCondicion = 0;
  for (const g of GRUPOS) {
    if (g.seguridad) continue;
    let peor = null;
    for (const [clave] of g.items) {
      const n = insp[clave];
      if (!n || n === 'no_verificado' || reparar.has(clave)) continue;
      if (peor === null || orden(n) > orden(peor)) peor = n;
    }
    const pct = peor ? Math.round((cfg.depreciacion_nivel[peor] || 0) * (cfg.peso_grupo[g.clave] ?? 1) * 10) / 10 : 0;
    grupos[g.clave] = { peor, pct };
    depCondicion += pct;
  }
  depCondicion = Math.min(cfg.tope_depreciacion_pct, Math.round(depCondicion * 10) / 10);
  const pendientes = ITEMS.filter((i) => i.obligatorio && (!insp[i.clave] || insp[i.clave] === 'no_verificado')).map((i) => i.clave);
  const seguridadBloquea = ITEMS.filter((i) => i.seguridad && insp[i.clave] === 'no_funciona').map((i) => i.clave);
  const seguridadObs = ITEMS.filter((i) => i.seguridad && ['regular', 'deficiente'].includes(insp[i.clave])).map((i) => i.clave);
  const gradoSugerido = gradoPorDepreciacion(cfg, depCondicion);
  let base = null, baseOrigen = null, depAntiguedad = 0, estimado = false;
  if (Number(d.valor_mercado) > 0) { base = Math.round(Number(d.valor_mercado)); baseOrigen = 'mercado'; }
  else if (Number(d.precio_nuevo_referencia) > 0) {
    depAntiguedad = Math.min(cfg.antiguedad_tope_pct, Math.round((Number(d.antiguedad_anios) || 0) * cfg.antiguedad_pct_anio * 10) / 10);
    base = Math.round(Number(d.precio_nuevo_referencia) * (cfg.factor_usado_sobre_nuevo_pct / 100) * (1 - depAntiguedad / 100));
    baseOrigen = 'estimado_desde_nuevo'; estimado = true;
  }
  const valorAjustado = base !== null ? Math.round(base * (1 - depCondicion / 100)) : null;
  const num = (v) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v)));
  const reparacion = num(d.costo_reparacion) ?? 0;
  const preparacion = num(d.costo_preparacion) ?? cfg.preparacion_defecto;
  const reserva = num(d.reserva_riesgo) ?? (valorAjustado !== null ? Math.round(valorAjustado * cfg.reserva_riesgo_pct / 100) : 0);
  const margen = num(d.margen_objetivo) ?? (valorAjustado !== null ? Math.round(valorAjustado * cfg.margen_objetivo_pct / 100) : 0);
  const costoMaximo = valorAjustado !== null ? Math.max(0, valorAjustado - reparacion - preparacion - reserva - margen) : null;
  const ofertaSugerida = costoMaximo !== null ? redondear(costoMaximo * cfg.oferta_inicial_pct / 100, cfg.redondeo) : null;
  const oferta = num(d.oferta_final) ?? ofertaSugerida;
  const margenEsperado = valorAjustado !== null && oferta !== null ? valorAjustado - oferta - reparacion - preparacion - reserva : null;
  const requiereExcepcion = costoMaximo !== null && oferta !== null && oferta > costoMaximo;
  let clasificacion;
  if (valorAjustado === null || pendientes.length) clasificacion = 'pendiente';
  else if (seguridadBloquea.length || margenEsperado <= 0) clasificacion = 'no_recomendable';
  else if (!requiereExcepcion) clasificacion = 'favorable';
  else clasificacion = 'ajustada';
  return {
    base, base_origen: baseOrigen, estimado, grado_sugerido: gradoSugerido, grado: GRADOS.includes(d.grado) ? d.grado : gradoSugerido, depreciacion: { condicion_pct: depCondicion, antiguedad_pct: depAntiguedad, grupos },
    valor_ajustado: valorAjustado, reparacion, preparacion, reserva, margen_objetivo: margen, costo_maximo: costoMaximo, oferta_sugerida: ofertaSugerida, oferta,
    margen_esperado: margenEsperado, requiere_excepcion: requiereExcepcion, clasificacion, inspeccion_completa: pendientes.length === 0, pendientes, seguridad_bloquea: seguridadBloquea, seguridad_observaciones: seguridadObs,
  };
}

// ---------- Validación de datos del formulario (parcial: cada paso guarda lo suyo) ----------
function sanear(db, datos, actual) {
  const d = {};
  const t = (k, max = 120) => { if (datos[k] !== undefined) d[k] = texto(datos[k], k, { opcional: true, max }); };
  ['marca', 'modelo', 'capacidad', 'color', 'serial', 'vendedor_nombre', 'vendedor_contacto', 'vendedor_identificacion', 'forma_pago', 'aceptado_nombre'].forEach((k) => t(k));
  t('accesorios', 300); t('observaciones', 1000); t('observaciones_inspector', 2000); t('excepcion_motivo', 300);
  for (const k of ['imei1', 'imei2']) {
    if (datos[k] === undefined) continue;
    const v = String(datos[k] || '').replace(/\s+/g, '');
    if (v && !/^\d{8,20}$/.test(v)) throw err.datos(`${k.toUpperCase()} inválido: solo dígitos (8 a 20)`);
    d[k] = v || null;
  }
  for (const k of ['precio_nuevo_referencia', 'valor_mercado', 'costo_reparacion', 'costo_preparacion', 'reserva_riesgo', 'margen_objetivo', 'oferta_final']) {
    if (datos[k] === undefined) continue;
    d[k] = datos[k] === null || datos[k] === '' ? null : entero(datos[k], k, { min: 0 });
  }
  if (datos.bateria_pct !== undefined) d.bateria_pct = datos.bateria_pct === null || datos.bateria_pct === '' ? null : entero(datos.bateria_pct, 'Salud de batería', { min: 0, max: 100 });
  if (datos.antiguedad_anios !== undefined) d.antiguedad_anios = datos.antiguedad_anios === null || datos.antiguedad_anios === '' ? null : decimal(datos.antiguedad_anios, 'Antigüedad', { min: 0, max: 30 });
  if (datos.grado !== undefined) d.grado = datos.grado ? opcion(String(datos.grado).toUpperCase(), 'Grado', GRADOS) : null;
  if (datos.cliente_id !== undefined) d.cliente_id = datos.cliente_id ? entero(datos.cliente_id, 'Cliente') : null;
  if (datos.paso !== undefined) d.paso = entero(datos.paso, 'Paso', { min: 1, max: 4 });
  if (datos.fecha_recepcion !== undefined && datos.fecha_recepcion) d.fecha_recepcion = String(datos.fecha_recepcion).slice(0, 19);
  if (datos.inspeccion !== undefined) {
    if (datos.inspeccion && typeof datos.inspeccion !== 'object') throw err.datos('Inspección inválida');
    const limpio = {};
    for (const [k, v] of Object.entries(datos.inspeccion || {})) { if (!ITEM[k]) continue; if (!NIVELES.includes(v)) throw err.datos(`Nivel inválido para ${ITEM[k].nombre}`); limpio[k] = v; }
    d.inspeccion = JSON.stringify(limpio);
  }
  if (datos.inspeccion_reparar !== undefined) d.inspeccion_reparar = JSON.stringify((Array.isArray(datos.inspeccion_reparar) ? datos.inspeccion_reparar : []).filter((k) => ITEM[k]));
  if (datos.aceptado !== undefined) { d.aceptado = datos.aceptado ? 1 : 0; d.aceptado_en = datos.aceptado ? (actual && actual.aceptado ? actual.aceptado_en : ahora()) : null; }
  if (d.forma_pago !== undefined && d.forma_pago !== null) {
    const metodos = getConfig(db, 'metodos_pago') || [];
    if (d.forma_pago !== 'parte_de_pago' && !metodos.includes(d.forma_pago)) throw err.datos('Forma de pago inválida');
  }
  return d;
}

function parse(u) {
  if (!u) return u;
  for (const k of ['inspeccion', 'inspeccion_reparar', 'valoracion']) { try { u[k] = u[k] ? JSON.parse(u[k]) : (k === 'inspeccion_reparar' ? [] : k === 'inspeccion' ? {} : null); } catch { u[k] = k === 'inspeccion_reparar' ? [] : k === 'inspeccion' ? {} : null; } }
  return u;
}

function recalcular(db, id) {
  const u = parse(db.prepare('SELECT * FROM usados WHERE id = ?').get(id));
  const val = valorar(configValoracion(db), u);
  db.prepare('UPDATE usados SET valoracion = ?, clasificacion = ?, actualizado_en = ? WHERE id = ?').run(JSON.stringify(val), val.clasificacion, ahora(), id);
  return val;
}

// Qué falta para poder aprobar (se muestra como lista de verificación en la interfaz).
function faltantes(db, u, val) {
  const f = [];
  if (!u.marca || !u.modelo) f.push('Marca y modelo');
  if (!u.imei1 && !u.serial) f.push('IMEI o número de serie');
  if (!u.vendedor_nombre) f.push('Nombre del vendedor del equipo');
  if (!val.inspeccion_completa) f.push(`Inspección: ${val.pendientes.length} verificación(es) pendiente(s)`);
  if (val.valor_ajustado === null) f.push('Valor de mercado o precio del nuevo de referencia');
  if (!(val.oferta > 0)) f.push('Oferta al cliente');
  const fotos = db.prepare('SELECT tipo FROM usado_fotos WHERE usado_id = ?').all(u.id).map((x) => x.tipo);
  if (!fotos.includes('frontal') || !fotos.includes('trasera')) f.push('Fotografía frontal y trasera');
  if (!u.aceptado) f.push('Aceptación del precio por el cliente');
  if (!u.forma_pago) f.push('Forma de pago (efectivo, transferencia… o parte de pago)');
  if (val.seguridad_bloquea.length) f.push('Seguridad: hay verificaciones que NO cumplen');
  return f;
}

function verificarDuplicados(db, u) {
  for (const k of ['imei1', 'imei2']) {
    if (!u[k]) continue;
    const otro = db.prepare("SELECT numero FROM usados WHERE id <> ? AND estado IN ('pendiente_aprobacion','aprobada') AND (imei1 = ? OR imei2 = ?)").get(u.id, u[k], u[k]);
    if (otro) throw err.conflicto(`El IMEI ${u[k]} ya está registrado en la recepción ${otro.numero}`);
    const enStock = db.prepare("SELECT id FROM lotes WHERE serial = ? AND cantidad_restante > 0 AND estado <> 'anulado'").get(u[k]);
    if (enStock) throw err.conflicto(`El IMEI ${u[k]} ya está en inventario`);
  }
}

// ---------- CRUD ----------
function crear(db, datos, usuario) {
  if (!tiene(usuario, 'usados.registrar')) throw err.prohibido('No tienes permiso para recibir celulares usados');
  return transaccion(db, () => {
    const numero = siguienteNumero(db, 'usado', 'RU');
    const empleadoId = tiene(usuario, 'comisiones.administrar') && datos.empleado_id ? entero(datos.empleado_id, 'Empleado') : usuario.id;
    const r = db.prepare('INSERT INTO usados(numero, empleado_id, usuario_id, fecha_recepcion) VALUES (?,?,?,?)').run(numero, empleadoId, usuario.id, ahora());
    const id = Number(r.lastInsertRowid);
    auditoria.registrar(db, usuario, 'crear_usado', 'usado', id, { numero });
    return actualizar(db, id, datos, usuario);
  });
}

function actualizar(db, id, datos, usuario) {
  const actual = db.prepare('SELECT * FROM usados WHERE id = ?').get(id);
  if (!actual) throw err.noEncontrado('Recepción no existe');
  if (!tiene(usuario, 'usados.registrar')) throw err.prohibido();
  if (!['borrador', 'pendiente_aprobacion'].includes(actual.estado)) throw err.conflicto('La recepción ya está cerrada y no se puede editar');
  if (actual.estado === 'pendiente_aprobacion' && !tiene(usuario, 'usados.aprobar')) throw err.conflicto('La recepción está pendiente de aprobación: solo el empleador puede modificarla');
  if (actual.empleado_id !== usuario.id && !tiene(usuario, 'usados.aprobar')) throw err.prohibido('Solo quien negocia el equipo (o el empleador) puede editar esta recepción');
  const d = sanear(db, datos, actual);
  if (tiene(usuario, 'comisiones.administrar') && datos.empleado_id !== undefined) d.empleado_id = datos.empleado_id ? entero(datos.empleado_id, 'Empleado') : actual.empleado_id;
  return transaccion(db, () => {
    const claves = Object.keys(d);
    if (claves.length) db.prepare(`UPDATE usados SET ${claves.map((k) => `${k} = ?`).join(', ')}, actualizado_en = ? WHERE id = ?`).run(...claves.map((k) => d[k]), ahora(), id);
    const val = recalcular(db, id);
    if (d.oferta_final !== undefined && d.oferta_final !== actual.oferta_final) auditoria.registrar(db, usuario, 'oferta_usado', 'usado', id, { antes: actual.oferta_final, despues: d.oferta_final, costo_maximo: val.costo_maximo, requiere_excepcion: val.requiere_excepcion });
    return obtener(db, id);
  });
}

function obtener(db, id) {
  const u = parse(db.prepare(`SELECT u.*, e.nombre AS empleado_nombre, ur.nombre AS usuario_nombre, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, ap.nombre AS aprobada_por_nombre, ex.nombre AS excepcion_aprobada_por_nombre,
      p.nombre AS producto_nombre, l.cantidad_restante AS lote_restante, l.costo_unitario AS costo_actual, v.numero AS venta_numero, vr.numero AS venta_reventa_numero, vr.total AS venta_reventa_total
    FROM usados u LEFT JOIN usuarios e ON e.id = u.empleado_id LEFT JOIN usuarios ur ON ur.id = u.usuario_id LEFT JOIN clientes c ON c.id = u.cliente_id LEFT JOIN usuarios ap ON ap.id = u.aprobada_por LEFT JOIN usuarios ex ON ex.id = u.excepcion_aprobada_por
    LEFT JOIN productos p ON p.id = u.producto_id LEFT JOIN lotes l ON l.id = u.lote_id LEFT JOIN ventas v ON v.id = u.venta_id LEFT JOIN ventas vr ON vr.id = u.venta_reventa_id WHERE u.id = ?`).get(id));
  if (!u) throw err.noEncontrado('Recepción no existe');
  u.fotos = db.prepare('SELECT * FROM usado_fotos WHERE usado_id = ? ORDER BY id').all(id);
  u.costos = db.prepare('SELECT uc.*, us.nombre AS usuario_nombre FROM usado_costos uc LEFT JOIN usuarios us ON us.id = uc.usuario_id WHERE uc.usado_id = ? ORDER BY uc.id').all(id);
  u.costos_posteriores = u.costos.reduce((s, c) => s + c.valor, 0);
  const cfg = configValoracion(db);
  if (!u.valoracion) u.valoracion = valorar(cfg, u);
  if (!u.valoracion.grado_sugerido) u.valoracion.grado_sugerido = gradoPorDepreciacion(cfg, u.valoracion.depreciacion.condicion_pct);
  u.valoracion.grado = gradoDe(cfg, u.grado, u.valoracion);
  u.faltantes = ['borrador', 'pendiente_aprobacion'].includes(u.estado) ? faltantes(db, u, u.valoracion) : [];
  if (u.estado === 'aprobada') u.costo_total_adquisicion = (u.oferta_final || 0) + u.costos_posteriores;
  return u;
}

function listar(db, { estado, destino, q, empleado_id, desde, hasta, limite = 200 } = {}) {
  const cond = []; const params = [];
  if (estado === 'abiertas') cond.push("u.estado IN ('borrador','pendiente_aprobacion')");
  else if (estado) { cond.push('u.estado = ?'); params.push(estado); }
  if (destino) { cond.push('u.destino = ?'); params.push(destino); }
  if (empleado_id) { cond.push('u.empleado_id = ?'); params.push(Number(empleado_id)); }
  if (desde) { cond.push('u.fecha_recepcion >= ?'); params.push(desde + ' 00:00:00'); }
  if (hasta) { cond.push('u.fecha_recepcion <= ?'); params.push(hasta + ' 23:59:59'); }
  if (q) { cond.push('(u.numero LIKE ? OR u.marca LIKE ? OR u.modelo LIKE ? OR u.imei1 LIKE ? OR u.imei2 LIKE ? OR u.serial LIKE ? OR u.vendedor_nombre LIKE ?)'); params.push(...Array(7).fill(`%${q}%`)); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const filas = db.prepare(`SELECT u.id, u.numero, u.estado, u.paso, u.fecha_recepcion, u.marca, u.modelo, u.capacidad, u.color, u.imei1, u.vendedor_nombre, u.oferta_final, u.clasificacion, u.grado, u.destino, u.forma_pago, u.pagado, u.venta_id, u.venta_reventa_id, u.empleado_id, e.nombre AS empleado_nombre, u.valoracion
                             FROM usados u LEFT JOIN usuarios e ON e.id = u.empleado_id ${where} ORDER BY u.id DESC LIMIT ?`).all(...params, Math.min(Number(limite) || 200, 500));
  const cfg = configValoracion(db);
  for (const f of filas) { try { const v = f.valoracion ? JSON.parse(f.valoracion) : null; f.valor_ajustado = v ? v.valor_ajustado : null; f.costo_maximo = v ? v.costo_maximo : null; f.requiere_excepcion = v ? v.requiere_excepcion : false; f.grado = gradoDe(cfg, f.grado, v); } catch { /* nada */ } delete f.valoracion; }
  const conteo = {};
  for (const c of db.prepare('SELECT estado, COUNT(*) n FROM usados GROUP BY estado').all()) conteo[c.estado] = c.n;
  return { usados: filas, conteo };
}

function resumen(db) {
  const h = hoy();
  const mes = h.slice(0, 8) + '01';
  return {
    recibidos_mes: db.prepare("SELECT COUNT(*) n FROM usados WHERE estado = 'aprobada' AND fecha_recepcion >= ?").get(mes + ' 00:00:00').n,
    pendientes_inspeccion: db.prepare("SELECT COUNT(*) n FROM usados WHERE estado IN ('borrador','pendiente_aprobacion')").get().n,
    pendientes_aprobacion: db.prepare("SELECT COUNT(*) n FROM usados WHERE estado = 'pendiente_aprobacion'").get().n,
    en_stock: db.prepare("SELECT COUNT(*) n, COALESCE(SUM(oferta_final),0) invertido FROM usados u WHERE u.estado = 'aprobada' AND u.destino IN ('pendiente_revision','en_reparacion','disponible')").get(),
    vendidos_mes: db.prepare("SELECT COUNT(*) n FROM usados WHERE destino = 'vendido' AND estado = 'aprobada' AND fecha_recepcion >= ?").get(mes + ' 00:00:00').n,
  };
}

// ---------- Fotos ----------
function agregarFoto(db, id, { imagen, tipo, nota }, usuario) {
  const u = db.prepare('SELECT * FROM usados WHERE id = ?').get(id);
  if (!u) throw err.noEncontrado('Recepción no existe');
  if (!tiene(usuario, 'usados.registrar')) throw err.prohibido();
  if (!['borrador', 'pendiente_aprobacion'].includes(u.estado)) throw err.conflicto('La recepción ya está cerrada');
  const archivo = archivos.guardarDesdeBase64(imagen, null, 'foto');
  if (!archivo.mime.startsWith('image/')) throw err.datos('Solo se aceptan imágenes');
  const t = ['frontal', 'trasera', 'dano', 'otra'].includes(tipo) ? tipo : 'otra';
  const r = db.prepare('INSERT INTO usado_fotos(usado_id, tipo, ruta, nota) VALUES (?,?,?,?)').run(id, t, archivo.ruta, texto(nota, 'Nota', { opcional: true, max: 200 }));
  return db.prepare('SELECT * FROM usado_fotos WHERE id = ?').get(Number(r.lastInsertRowid));
}
function eliminarFoto(db, id, fotoId, usuario) {
  if (!tiene(usuario, 'usados.registrar')) throw err.prohibido();
  const u = db.prepare('SELECT estado FROM usados WHERE id = ?').get(id);
  if (!u || !['borrador', 'pendiente_aprobacion'].includes(u.estado)) throw err.conflicto('No se pueden eliminar fotos de una recepción cerrada');
  const f = db.prepare('SELECT * FROM usado_fotos WHERE id = ? AND usado_id = ?').get(fotoId, id);
  if (!f) throw err.noEncontrado('Foto no existe');
  db.prepare('DELETE FROM usado_fotos WHERE id = ?').run(fotoId);
  archivos.eliminar(f.ruta);
  return { ok: true };
}

// ---------- Flujo de aprobación ----------
function enviar(db, id, usuario) {
  const u = obtener(db, id);
  if (!tiene(usuario, 'usados.registrar')) throw err.prohibido();
  if (u.estado !== 'borrador') throw err.conflicto('La recepción no está en borrador');
  if (u.faltantes.length) throw err.conflicto(`Faltan validaciones obligatorias: ${u.faltantes.join('; ')}`, { faltantes: u.faltantes });
  verificarDuplicados(db, u);
  db.prepare("UPDATE usados SET estado = 'pendiente_aprobacion', paso = 4, actualizado_en = ? WHERE id = ?").run(ahora(), id);
  auditoria.registrar(db, usuario, 'enviar_usado', 'usado', id, { numero: u.numero, oferta: u.valoracion.oferta, costo_maximo: u.valoracion.costo_maximo, clasificacion: u.valoracion.clasificacion });
  return obtener(db, id);
}

// Busca (o crea) el producto "modelo usado" en la categoría Celulares usados. Cada equipo es un lote con su serial.
function asegurarProducto(db, u, val, usuario) {
  const nombre = `${u.marca} ${u.modelo}${u.capacidad ? ' ' + u.capacidad : ''} (usado)`.replace(/\s+/g, ' ').trim();
  const existente = db.prepare('SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE').get(nombre);
  if (existente) {
    db.prepare("UPDATE productos SET estado = CASE WHEN estado = 'inactivo' THEN 'activo' ELSE estado END, actualizado_en = ? WHERE id = ?").run(ahora(), existente.id);
    return existente.id;
  }
  const cat = db.prepare("SELECT id FROM categorias WHERE nombre = 'Celulares usados'").get();
  const sku = siguienteNumero(db, 'sku', 'SKU');
  const r = db.prepare(`INSERT INTO productos(nombre, categoria_id, marca, referencia, color, capacidad, sku, requiere_serial, descripcion, stock_minimo, precio_compra, precio_venta, estado, fecha_ingreso, actualizado_en)
                        VALUES (?,?,?,?,?,?,?,1,?,0,?,?,'activo',?,?)`)
    .run(nombre, cat ? cat.id : null, u.marca, u.modelo, u.color, u.capacidad, sku, 'Equipo usado recibido en retoma. Precio de venta sugerido = valor de reventa estimado en la recepción.', val.oferta, val.valor_ajustado, hoy(), ahora());
  const id = Number(r.lastInsertRowid);
  db.prepare("INSERT INTO historial_precios(producto_id, tipo, precio_anterior, precio_nuevo, usuario_id, usuario_nombre, motivo) VALUES (?,'venta',NULL,?,?,?,?)").run(id, val.valor_ajustado, usuario.id, usuario.nombre, `Creado desde recepción ${u.numero}`);
  auditoria.registrar(db, usuario, 'crear_producto', 'producto', id, { nombre, origen: 'usado', usado: u.numero });
  return id;
}

function aprobar(db, id, datos = {}, usuario) {
  if (!tiene(usuario, 'usados.registrar')) throw err.prohibido();
  return transaccion(db, () => {
    if (datos.forma_pago !== undefined || datos.excepcion_motivo !== undefined || datos.oferta_final !== undefined) actualizar(db, id, { forma_pago: datos.forma_pago, excepcion_motivo: datos.excepcion_motivo, oferta_final: datos.oferta_final }, usuario);
    const u = obtener(db, id);
    if (!['borrador', 'pendiente_aprobacion'].includes(u.estado)) throw err.conflicto('La recepción ya fue cerrada');
    if (u.faltantes.length) throw err.conflicto(`No se puede aprobar: ${u.faltantes.join('; ')}`, { faltantes: u.faltantes });
    verificarDuplicados(db, u);
    const val = u.valoracion;
    if (val.seguridad_bloquea.length) throw err.conflicto('No se puede aprobar: verificaciones de seguridad o propiedad que no cumplen');
    if (val.requiere_excepcion) {
      if (!tiene(usuario, 'usados.aprobar')) throw err.prohibido(`La oferta (${val.oferta.toLocaleString('es-CO')}) supera el costo máximo de adquisición (${val.costo_maximo.toLocaleString('es-CO')}): requiere aprobación del empleador`, { codigo: 'requiere_excepcion' });
      if (!u.excepcion_motivo) throw err.datos('Indica el motivo de la excepción (oferta por encima del costo máximo)');
      db.prepare('UPDATE usados SET excepcion_aprobada_por = ?, excepcion_aprobada_en = ? WHERE id = ?').run(usuario.id, ahora(), id);
    }
    const metodos = getConfig(db, 'metodos_pago') || [];
    const productoId = asegurarProducto(db, u, val, usuario);
    const serial = u.imei1 || u.serial;
    const loteId = inventario.crearLote(db, { producto_id: productoId, fecha: hoy(), cantidad: 1, costo_unitario: val.oferta, serial, origen: 'retoma', tipo_movimiento: 'retoma', referencia_tipo: 'usado', referencia_id: id, nota: `Recepción ${u.numero}` }, usuario);
    db.prepare('UPDATE productos SET precio_compra = ?, actualizado_en = ? WHERE id = ?').run(val.oferta, ahora(), productoId);
    let pagado = 0, pagadoEn = null, metodo = null;
    if (u.forma_pago !== 'parte_de_pago') {
      metodo = metodos.includes(u.forma_pago) ? u.forma_pago : 'efectivo';
      db.prepare("INSERT INTO pagos(fecha, tipo, usado_id, valor, metodo_pago, nota, usuario_id, caja_sesion_id, moneda, valor_moneda, tasa_cambio) VALUES (?,'otro',?,?,?,?,?,?,'COP',?,1)")
        .run(ahora(), id, val.oferta, metodo, `Compra de celular usado ${u.numero}`, usuario.id, caja.sesionAbiertaId(db), val.oferta);
      pagado = 1; pagadoEn = ahora();
    }
    db.prepare("UPDATE usados SET estado = 'aprobada', paso = 4, aprobada_en = ?, aprobada_por = ?, producto_id = ?, lote_id = ?, oferta_final = ?, grado = ?, pagado = ?, pagado_en = ?, metodo_pago = ?, destino = 'pendiente_revision', actualizado_en = ? WHERE id = ?")
      .run(ahora(), usuario.id, productoId, loteId, val.oferta, val.grado, pagado, pagadoEn, metodo, ahora(), id);
    recalcular(db, id);
    auditoria.registrar(db, usuario, 'aprobar_usado', 'usado', id, { numero: u.numero, oferta: val.oferta, costo_maximo: val.costo_maximo, valor_reventa: val.valor_ajustado, clasificacion: val.clasificacion, excepcion: val.requiere_excepcion, forma_pago: u.forma_pago, producto_id: productoId, lote_id: loteId });
    return obtener(db, id);
  });
}

function rechazar(db, id, motivo, usuario) {
  if (!tiene(usuario, 'usados.aprobar')) throw err.prohibido('Solo el empleador puede rechazar una recepción enviada');
  const u = db.prepare('SELECT * FROM usados WHERE id = ?').get(id);
  if (!u) throw err.noEncontrado('Recepción no existe');
  if (!['borrador', 'pendiente_aprobacion'].includes(u.estado)) throw err.conflicto('La recepción ya fue cerrada');
  const mot = texto(motivo, 'Motivo', { max: 300 });
  db.prepare("UPDATE usados SET estado = 'rechazada', rechazo_motivo = ?, actualizado_en = ? WHERE id = ?").run(mot, ahora(), id);
  auditoria.registrar(db, usuario, 'rechazar_usado', 'usado', id, { numero: u.numero, motivo: mot });
  return obtener(db, id);
}

// Anular: borradores y pendientes (quien los creó o el empleador); aprobadas solo el empleador y si el equipo sigue en inventario.
function anular(db, id, motivo, usuario) {
  const u = db.prepare('SELECT * FROM usados WHERE id = ?').get(id);
  if (!u) throw err.noEncontrado('Recepción no existe');
  const mot = texto(motivo, 'Motivo', { max: 300 });
  return transaccion(db, () => {
    if (['borrador', 'pendiente_aprobacion'].includes(u.estado)) {
      if (!(tiene(usuario, 'usados.aprobar') || (tiene(usuario, 'usados.registrar') && u.empleado_id === usuario.id))) throw err.prohibido();
    } else if (u.estado === 'aprobada') {
      if (!tiene(usuario, 'usados.aprobar')) throw err.prohibido('Solo el empleador puede anular una compra aprobada');
      if (u.venta_id) throw err.conflicto('Este equipo entró como parte de pago de una venta: anula primero esa venta');
      const lote = db.prepare('SELECT * FROM lotes WHERE id = ?').get(u.lote_id);
      if (!lote || lote.cantidad_restante < 1) throw err.conflicto('El equipo ya salió del inventario: no se puede anular la compra');
      db.prepare("UPDATE lotes SET cantidad_restante = 0, estado = 'anulado' WHERE id = ?").run(lote.id);
      inventario.registrarMovimiento(db, { producto_id: lote.producto_id, lote_id: lote.id, tipo: 'anulacion_usado', cantidad: -1, costo_unitario: lote.costo_unitario, referencia_tipo: 'usado', referencia_id: id, nota: `Anulación ${u.numero}: ${mot}` }, usuario);
      inventario.actualizarEstadoProducto(db, lote.producto_id);
      db.prepare("UPDATE pagos SET anulado = 1, anulado_en = ? WHERE usado_id = ? AND anulado = 0").run(ahora(), id);
    } else throw err.conflicto('La recepción ya está cerrada');
    db.prepare("UPDATE usados SET estado = 'anulada', rechazo_motivo = ?, actualizado_en = ? WHERE id = ?").run(mot, ahora(), id);
    auditoria.registrar(db, usuario, 'anular_usado', 'usado', id, { numero: u.numero, estado_anterior: u.estado, motivo: mot });
    return obtener(db, id);
  });
}

function cambiarDestino(db, id, destino, usuario) {
  if (!tiene(usuario, 'usados.registrar')) throw err.prohibido();
  const u = db.prepare('SELECT * FROM usados WHERE id = ?').get(id);
  if (!u) throw err.noEncontrado('Recepción no existe');
  if (u.estado !== 'aprobada') throw err.conflicto('Solo las compras aprobadas tienen destino');
  const nuevo = opcion(destino, 'Destino', DESTINOS.filter((d) => d !== 'vendido'));
  if (u.destino === 'vendido') throw err.conflicto('El equipo ya se vendió');
  if (u.destino === 'retirado') throw err.conflicto('El equipo ya fue retirado');
  return transaccion(db, () => {
    if (nuevo === 'retirado') {
      const lote = db.prepare('SELECT * FROM lotes WHERE id = ?').get(u.lote_id);
      if (lote && lote.cantidad_restante > 0) inventario.consumir(db, { producto_id: lote.producto_id, cantidad: 1, seriales: lote.serial ? [lote.serial] : null, tipo_movimiento: 'perdida', referencia_tipo: 'usado', referencia_id: id, nota: `Retiro / baja ${u.numero}` }, usuario);
    }
    db.prepare('UPDATE usados SET destino = ?, actualizado_en = ? WHERE id = ?').run(nuevo, ahora(), id);
    auditoria.registrar(db, usuario, 'destino_usado', 'usado', id, { numero: u.numero, antes: u.destino, despues: nuevo });
    return obtener(db, id);
  });
}

// Costos reales posteriores (reparación/preparación): se capitalizan en el costo del lote mientras el equipo esté en inventario.
function agregarCosto(db, id, { tipo, descripcion, valor, metodo_pago }, usuario) {
  if (!tiene(usuario, 'usados.registrar')) throw err.prohibido();
  const u = db.prepare('SELECT * FROM usados WHERE id = ?').get(id);
  if (!u) throw err.noEncontrado('Recepción no existe');
  if (u.estado !== 'aprobada') throw err.conflicto('Solo las compras aprobadas admiten costos');
  if (['vendido', 'retirado'].includes(u.destino)) throw err.conflicto('El equipo ya salió del inventario: el costo no puede sumarse a su lote');
  const t = opcion(tipo, 'Tipo de costo', ['reparacion', 'preparacion', 'otro']);
  const v = entero(valor, 'Valor', { min: 1 });
  const desc = texto(descripcion, 'Descripción', { opcional: true, max: 300 });
  const metodos = getConfig(db, 'metodos_pago') || [];
  const metodo = metodos.includes(metodo_pago) ? metodo_pago : 'efectivo';
  return transaccion(db, () => {
    const r = db.prepare('INSERT INTO usado_costos(usado_id, tipo, descripcion, valor, usuario_id) VALUES (?,?,?,?,?)').run(id, t, desc, v, usuario.id);
    const lote = db.prepare('SELECT * FROM lotes WHERE id = ?').get(u.lote_id);
    if (lote) {
      db.prepare('UPDATE lotes SET costo_unitario = costo_unitario + ?, costo_unitario_moneda = costo_unitario_moneda + ? WHERE id = ?').run(v, v, lote.id);
      db.prepare('UPDATE productos SET precio_compra = ?, actualizado_en = ? WHERE id = ?').run(lote.costo_unitario + v, ahora(), lote.producto_id);
      inventario.registrarMovimiento(db, { producto_id: lote.producto_id, lote_id: lote.id, tipo: 'costo_usado', cantidad: 0, costo_unitario: lote.costo_unitario + v, referencia_tipo: 'usado', referencia_id: id, nota: `${t}: ${desc || ''} (+${v})` }, usuario);
    }
    db.prepare("INSERT INTO pagos(fecha, tipo, usado_id, valor, metodo_pago, nota, usuario_id, caja_sesion_id, moneda, valor_moneda, tasa_cambio) VALUES (?,'otro',?,?,?,?,?,?,'COP',?,1)").run(ahora(), id, v, metodo, `${t === 'reparacion' ? 'Reparación' : t === 'preparacion' ? 'Preparación' : 'Costo'} de ${u.numero}${desc ? ': ' + desc : ''}`, usuario.id, caja.sesionAbiertaId(db), v);
    auditoria.registrar(db, usuario, 'costo_usado', 'usado', id, { numero: u.numero, tipo: t, valor: v, descripcion: desc });
    return { id: Number(r.lastInsertRowid), usado: obtener(db, id) };
  });
}

// Equipos aprobados que pueden entrar como parte de pago de una venta (aún no pagados ni vinculados).
function disponiblesParteDePago(db, q) {
  const like = q ? `%${q}%` : null;
  return db.prepare(`SELECT u.id, u.numero, u.marca, u.modelo, u.capacidad, u.imei1, u.vendedor_nombre, u.cliente_id, u.oferta_final, u.fecha_recepcion FROM usados u
                     WHERE u.estado = 'aprobada' AND u.forma_pago = 'parte_de_pago' AND u.pagado = 0 AND u.venta_id IS NULL ${like ? 'AND (u.numero LIKE ? OR u.marca LIKE ? OR u.modelo LIKE ? OR u.imei1 LIKE ? OR u.vendedor_nombre LIKE ?)' : ''}
                     ORDER BY u.id DESC LIMIT 20`).all(...(like ? [like, like, like, like, like] : []));
}

// Celulares usados comprados que siguen en inventario: se muestran en Vender, uno por equipo (nombre, grado, IMEI, precio).
function disponiblesVenta(db, q) {
  const like = q ? `%${q}%` : null;
  const cfg = configValoracion(db);
  const filas = db.prepare(`SELECT u.id, u.numero, u.marca, u.modelo, u.capacidad, u.color, u.imei1, u.serial AS serial_equipo, u.grado, u.bateria_pct, u.destino, u.valoracion,
      l.serial, l.costo_unitario, p.id AS producto_id, p.nombre AS producto_nombre, p.precio_venta,
      COALESCE((SELECT ruta FROM usado_fotos uf WHERE uf.usado_id = u.id ORDER BY uf.tipo <> 'frontal', uf.id LIMIT 1),
               (SELECT ruta FROM producto_fotos pf WHERE pf.producto_id = p.id ORDER BY pf.principal DESC, pf.id LIMIT 1)) AS foto
    FROM usados u JOIN lotes l ON l.id = u.lote_id JOIN productos p ON p.id = u.producto_id
    WHERE u.estado = 'aprobada' AND u.destino NOT IN ('vendido','retirado') AND l.cantidad_restante > 0 AND l.estado <> 'anulado'
    ${like ? 'AND (u.numero LIKE ? OR u.marca LIKE ? OR u.modelo LIKE ? OR u.imei1 LIKE ? OR l.serial LIKE ? OR p.nombre LIKE ?)' : ''}
    ORDER BY u.id DESC LIMIT 100`).all(...(like ? Array(6).fill(like) : []));
  for (const f of filas) {
    let v = null; try { v = f.valoracion ? JSON.parse(f.valoracion) : null; } catch { /* nada */ }
    f.grado = gradoDe(cfg, f.grado, v);
    f.nombre = [f.marca, f.modelo, f.capacidad, f.color].filter(Boolean).join(' ');
    delete f.valoracion;
  }
  return filas;
}

function catalogo(db) {
  return { grupos: GRUPOS.map((g) => ({ clave: g.clave, nombre: g.nombre, seguridad: !!g.seguridad, items: g.items.map(([clave, nombre, obligatorio]) => ({ clave, nombre, obligatorio })) })), niveles: NIVELES, destinos: DESTINOS, grados: GRADOS, config: configValoracion(db) };
}

module.exports = { GRADOS, disponiblesVenta, NIVELES, GRUPOS, ITEMS, DESTINOS, configValoracion, valorar, crear, actualizar, obtener, listar, resumen, agregarFoto, eliminarFoto, enviar, aprobar, rechazar, anular, cambiarDestino, agregarCosto, disponiblesParteDePago, catalogo, faltantes };
