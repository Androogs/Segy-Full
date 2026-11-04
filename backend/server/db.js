'use strict';
// Acceso a la base de datos SQLite (módulo integrado node:sqlite: sin dependencias nativas que compilar en el hosting).
// Al abrir: aplica el esquema (idempotente), agrega columnas nuevas a bases antiguas y recrea vistas e índices.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

const { DATA_DIR, UPLOADS_DIR, BACKUPS_DIR, DB_PATH } = config;
const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

const CONFIG_DEFAULT = {
  negocio_nombre: 'SEGY',
  negocio_nit: '',
  negocio_direccion: '',
  negocio_telefono: '',
  negocio_ciudad: '',
  mensaje_comprobante: 'Gracias por su compra. Garantía según políticas del almacén.',
  metodo_valoracion: 'FIFO',
  permitir_stock_negativo: false,
  descuento_maximo_pct: 10,
  dias_alerta_vencimiento: 7,
  metodos_pago: ['efectivo', 'transferencia', 'nequi', 'daviplata', 'tarjeta', 'otro'],
  categorias_gasto: ['Arriendo', 'Servicios públicos', 'Transporte', 'Nómina', 'Comisiones', 'Publicidad', 'Reparaciones', 'Otros gastos'],
  dias_sin_movimiento: 30,
  ocr_modelo: 'claude-opus-5-5',
  api_token_hash: '',
  permisos_roles: null,
  // Contabilidad y tasa de cambio
  trm_frecuencia_minutos: 60,
  mercado_frecuencia_minutos: 30,
  moneda_presentacion: 'COP',
  politica_diferencia_cambiaria: 'realizada', // la diferencia se reconoce al pagar/cobrar en USD a una tasa distinta a la de la operación
  // Valoración de celulares usados (todo configurable desde Configuración › Usados y comisiones)
  valoracion_usados: {
    depreciacion_nivel: { excelente: 0, bueno: 3, regular: 10, deficiente: 25, no_funciona: 45 }, // % por el peor ítem de cada grupo
    peso_grupo: { pantalla: 1, bateria: 0.6, funcionamiento: 0.8, fisico: 0.5 },                 // multiplicador del % por grupo
    tope_depreciacion_pct: 70,
    grado_a_max_pct: 10, grado_b_max_pct: 25, // grado sugerido: A hasta 10 % de depreciación por condición, B hasta 25 %, C el resto
    factor_usado_sobre_nuevo_pct: 65,  // sin valor de mercado: valor base = precio del nuevo × factor × (1 − antigüedad)
    antiguedad_pct_anio: 8, antiguedad_tope_pct: 40,
    preparacion_defecto: 20000,
    reserva_riesgo_pct: 4,
    margen_objetivo_pct: 20,
    oferta_inicial_pct: 95,            // oferta sugerida = costo máximo × este %
    redondeo: 1000,
  },
  // Marketing y atribución de ventas a campañas (ver docs/MARKETING.md)
  marketing: {
    ventana_atribucion_dias: 30,     // una venta se atribuye como "estimada" si el cliente contactó por una campaña dentro de esta ventana
    token_seguimiento: '',           // token público del script de seguimiento web (vacío = no se aceptan eventos externos)
    canales: ['whatsapp', 'web', 'instagram', 'facebook', 'tiktok', 'google', 'referido', 'presencial', 'otro'],
  },
  // Asistente Astro (ver docs/ASISTENTE.md). La clave del proveedor va en variables de entorno, nunca aquí.
  asistente: {
    activo: true,
    proveedor: 'anthropic',          // 'anthropic' (SDK oficial) | 'openrouter'
    modelo: 'claude-opus-5-5',
    limite_mensajes_hora: 40,        // por usuario
    voz: true,                       // permite dictar por voz (reconocimiento del navegador) y leer respuestas
    nombre: 'Astro',
  },
  // Tienda web pública (ver docs/TIENDA.md). Se edita desde el panel en Tienda web › Ajustes.
  tienda: {
    activa: true,
    url_tienda: '',                  // dirección pública de la tienda (https://segy.com.co): botón "Ver tienda" y enlaces de seguimiento
    publicar_por_defecto: true,      // productos activos con precio aparecen en la página salvo que se oculten uno a uno
    mostrar_agotados: true,          // se muestran como "Agotado" (con opción de avisar por WhatsApp) en vez de ocultarse
    whatsapp: '',                    // vacío = se usa el teléfono del negocio
    horario: '',
    mapa_url: '',
    mensajes_barra: ['Paga a cuotas con crédito SEGY', 'Recibimos tu celular como parte de pago', 'Garantía y soporte en Palmira'],
    envio: { local_nombre: 'Domicilio en Palmira', local_costo: null, nacional: true, nacional_costo: null, gratis_desde: null }, // null = se confirma con el cliente
    pagos: ['transferencia', 'contraentrega', 'tienda', 'credito'],
    credito: { activo: true, cuota_inicial_min_pct: 30, planes: [{ cuotas: 3, interes_pct: 0 }, { cuotas: 6, interes_pct: 0 }, { cuotas: 12, interes_pct: 0 }] }, // interes_pct = % total sobre el saldo, como en Créditos
    producto_insignia_id: null,      // producto de la experiencia 3D del inicio; null = el primero llamado "iPhone 17 Pro Max"
    redes: { instagram: '', facebook: '', tiktok: '' },
  },
  // Remuneración: salario y comisión por defecto para vendedores (cada usuario puede tener sus propios valores)
  comisiones: {
    salario_defecto: 3000000,
    comision_pct_defecto: 10,
    devengo: 'confirmacion',           // 'confirmacion' = al confirmar la venta · 'cobro' = solo ventas cobradas por completo
    empleador_comisiona: false,
  },
};


function asegurarCarpetas() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, BACKUPS_DIR]) fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
}

// Divide el esquema en sentencias (no contiene triggers ni ';' dentro de literales).
function sentencias(sql) {
  return sql.replace(/^\s*--.*$/gm, '').split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean);
}
const SENTENCIAS = sentencias(SCHEMA);
const TABLAS_SQL = SENTENCIAS.filter((s) => /^CREATE TABLE/i.test(s));
const OTRAS_SQL = SENTENCIAS.filter((s) => !/^CREATE TABLE/i.test(s));

// Columnas esperadas por tabla, leídas de una base en memoria construida con el esquema oficial.
let esperadas = null;
function columnasEsperadas() {
  if (esperadas) return esperadas;
  const mem = new DatabaseSync(':memory:');
  for (const s of TABLAS_SQL) mem.exec(s);
  esperadas = {};
  for (const { name } of mem.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    esperadas[name] = mem.prepare(`PRAGMA table_info("${name}")`).all();
  }
  mem.close();
  return esperadas;
}

function abrir(ruta = DB_PATH) {
  if (ruta !== ':memory:') fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  if (ruta !== ':memory:') { db.exec('PRAGMA journal_mode = WAL;'); db.exec('PRAGMA synchronous = NORMAL;'); }
  migrarSeguridad(db);
  for (const s of TABLAS_SQL) db.exec(s);
  const agregadas = completarColumnas(db);
  db.exec('DROP VIEW IF EXISTS v_stock');
  for (const s of OTRAS_SQL) db.exec(s);
  migrarDatos(db, agregadas);
  return db;
}

// Agrega a las tablas existentes toda columna del esquema que falte. SQLite no permite agregar columnas NOT NULL sin
// valor constante ni con DEFAULT de expresión: en esos casos se agregan como opcionales.
function completarColumnas(db) {
  const agregadas = new Set();
  for (const [tabla, cols] of Object.entries(columnasEsperadas())) {
    const actuales = new Set(db.prepare(`PRAGMA table_info("${tabla}")`).all().map((c) => c.name));
    for (const c of cols) {
      if (actuales.has(c.name) || c.pk) continue;
      const def = c.dflt_value;
      const constante = def !== null && !/\(/.test(def);
      let ddl = `ALTER TABLE "${tabla}" ADD COLUMN "${c.name}" ${c.type || ''}`;
      if (constante) ddl += `${c.notnull ? ' NOT NULL' : ''} DEFAULT ${def}`;
      db.exec(ddl);
      agregadas.add(`${tabla}.${c.name}`);
    }
  }
  return agregadas;
}

// Cambios de seguridad sobre bases de versiones anteriores (antes de aplicar el esquema).
function migrarSeguridad(db) {
  const existe = (t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  const cols = (t) => db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
  // Sesiones antiguas guardaban el token en claro: se descartan (todos vuelven a iniciar sesión una vez).
  if (existe('sesiones') && cols('sesiones').includes('token')) db.exec('DROP TABLE sesiones');
  // Códigos de recuperación antiguos en texto plano: se invalidan.
  if (existe('recuperacion_clave') && !cols('recuperacion_clave').includes('codigo_hash')) {
    db.exec('UPDATE recuperacion_clave SET usado = 1, codigo = NULL');
  }
}

// Rellenos de datos para columnas recién agregadas (bases de versiones anteriores).
function migrarDatos(db, agregadas) {
  if (agregadas.has('compras.total_moneda')) {
    db.exec(`
      UPDATE compras SET tasa_cambio = 1, subtotal_moneda = subtotal, descuento_moneda = descuento, total_moneda = total, valor_pagado_moneda = valor_pagado, saldo_pendiente_moneda = saldo_pendiente WHERE moneda = 'COP' AND total_moneda IS NULL;
      UPDATE compra_items SET costo_unitario_moneda = costo_unitario, descuento_moneda = descuento WHERE costo_unitario_moneda IS NULL;
      UPDATE lotes SET tasa_cambio = 1, costo_unitario_moneda = costo_unitario WHERE moneda = 'COP' AND costo_unitario_moneda IS NULL;
      UPDATE ventas SET tasa_cambio = 1, subtotal_moneda = subtotal, total_moneda = total, ganancia_neta = ganancia - comision - gastos_venta WHERE moneda = 'COP' AND total_moneda IS NULL;
      UPDATE venta_items SET precio_unitario_moneda = precio_unitario, descuento_moneda = descuento WHERE precio_unitario_moneda IS NULL;
      UPDATE venta_item_lotes SET tasa_compra = 1, costo_unitario_moneda = costo_unitario WHERE tasa_compra IS NULL;
      UPDATE pagos SET valor_moneda = valor, tasa_cambio = 1 WHERE moneda = 'COP' AND valor_moneda IS NULL;
      UPDATE creditos SET tasa_cambio = 1, saldo_financiado_moneda = saldo_financiado, saldo_moneda = saldo_actual WHERE moneda = 'COP' AND saldo_moneda IS NULL;
      UPDATE credito_cuotas SET valor_moneda = valor, pagado_moneda = pagado WHERE valor_moneda IS NULL;`);
  }
  if (agregadas.has('ventas.responsable_tipo')) {
    db.exec(`UPDATE ventas SET responsable_tipo = (SELECT CASE WHEN u.rol = 'admin' THEN 'empleador' WHEN u.rol IN ('vendedor','cajero') THEN 'vendedor' ELSE 'otro' END FROM usuarios u WHERE u.id = ventas.vendedor_id) WHERE responsable_tipo IS NULL AND vendedor_id IS NOT NULL;
             UPDATE ventas SET registrado_por = vendedor_id WHERE registrado_por IS NULL;`);
  }
  // Token de API: antes se guardaba en claro; ahora solo su huella SHA-256.
  const fila = db.prepare("SELECT valor FROM configuracion WHERE clave = 'api_token'").get();
  if (fila) {
    let token = '';
    try { token = JSON.parse(fila.valor) || ''; } catch { token = fila.valor || ''; }
    if (token) setConfig(db, 'api_token_hash', require('node:crypto').createHash('sha256').update(String(token)).digest('hex'));
    db.prepare("DELETE FROM configuracion WHERE clave = 'api_token'").run();
  }
}

let instancia = null;
function getDb() {
  if (!instancia) {
    if (DB_PATH !== ':memory:') asegurarCarpetas();
    instancia = abrir(DB_PATH);
  }
  return instancia;
}
function cerrarDb() {
  if (instancia) { try { instancia.close(); } catch { /* ya cerrada */ } instancia = null; }
}

// Transacciones anidables (SAVEPOINT). Todo lo que falle dentro revierte el conjunto.
const profundidad = new WeakMap();
function transaccion(db, fn) {
  const d = profundidad.get(db) || 0;
  if (d === 0) db.exec('BEGIN IMMEDIATE');
  else db.exec(`SAVEPOINT sp${d}`);
  profundidad.set(db, d + 1);
  try {
    const r = fn();
    if (d === 0) db.exec('COMMIT');
    else db.exec(`RELEASE sp${d}`);
    return r;
  } catch (e) {
    try {
      if (d === 0) db.exec('ROLLBACK');
      else db.exec(`ROLLBACK TO sp${d}; RELEASE sp${d}`);
    } catch { /* ya revertida */ }
    throw e;
  } finally {
    profundidad.set(db, d);
  }
}

function siguienteNumero(db, nombre, prefijo) {
  db.prepare('INSERT INTO contadores(nombre, valor) VALUES (?, 0) ON CONFLICT(nombre) DO NOTHING').run(nombre);
  db.prepare('UPDATE contadores SET valor = valor + 1 WHERE nombre = ?').run(nombre);
  const { valor } = db.prepare('SELECT valor FROM contadores WHERE nombre = ?').get(nombre);
  return `${prefijo}-${String(valor).padStart(6, '0')}`;
}

function getConfig(db, clave) {
  const fila = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
  if (!fila) return CONFIG_DEFAULT[clave];
  try { return JSON.parse(fila.valor); } catch { return fila.valor; }
}

function getConfigTodo(db) {
  const salida = { ...CONFIG_DEFAULT };
  for (const f of db.prepare('SELECT clave, valor FROM configuracion').all()) {
    try { salida[f.clave] = JSON.parse(f.valor); } catch { salida[f.clave] = f.valor; }
  }
  return salida;
}

function setConfig(db, clave, valor) {
  db.prepare('INSERT INTO configuracion(clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor')
    .run(clave, JSON.stringify(valor));
}

module.exports = {
  DATA_DIR, UPLOADS_DIR, BACKUPS_DIR, DB_PATH, CONFIG_DEFAULT,
  abrir, getDb, cerrarDb, transaccion, siguienteNumero, getConfig, getConfigTodo, setConfig, asegurarCarpetas,
};
