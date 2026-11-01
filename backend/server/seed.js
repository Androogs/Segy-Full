'use strict';
// Datos de prueba: usuarios, catálogo, proveedores, clientes, compras (lotes a distintos costos), ventas, créditos, gastos y caja.
// Uso: `npm run seed` (solo si la base está vacía) · `npm run seed -- --forzar` (borra y vuelve a crear).
const fs = require('node:fs');
const path = require('node:path');
const { getDb, DB_PATH, setConfig, asegurarCarpetas } = require('./db');
const seg = require('./seguridad');
const config = require('./config');
const { permisosDeRol } = require('./permisos');
const { hoy, sumarDias } = require('./util');
const productos = require('./services/productos');
const compras = require('./services/compras');
const ventas = require('./services/ventas');
const creditos = require('./services/creditos');
const caja = require('./services/caja');
const gastos = require('./services/gastos');

function sembrar(db, { silencioso = false } = {}) {
  const log = (...a) => { if (!silencioso) console.log(...a); };
  const usuario = (id, nombre, rol) => ({ id, nombre, rol, permisos: permisosDeRol(rol) });

  // Usuarios
  const USUARIOS = [
    ['Administrador', 'admin', 'Demo2026*Segy', 'admin', 0],
    ['Carlos Vendedor', 'carlos', 'Vendedor2026*', 'vendedor', 0],
    ['Luisa Cajera', 'luisa', 'Cajera2026*', 'cajero', 0],
    ['Pedro Inventario', 'pedro', 'Inventario2026*', 'inventario', 0],
    ['Contadora', 'conta', 'Consulta2026*', 'consulta', 0],
  ];
  const ins = db.prepare('INSERT INTO usuarios(nombre, usuario, password_hash, rol, debe_cambiar_clave, email) VALUES (?,?,?,?,?,?)');
  for (const [nombre, u, clave, rol, cambiar] of USUARIOS) ins.run(nombre, u, seg.hashClaveSync(clave), rol, cambiar, `${u}@ejemplo.com`);
  // Remuneración de prueba: el vendedor gana $3.000.000 de salario + 10 % de la ganancia de sus ventas; el administrador es el empleador.
  db.prepare("UPDATE usuarios SET salario_mensual = 3000000, comision_pct = 10, tipo_comercial = 'vendedor' WHERE usuario IN ('carlos','luisa')").run();
  db.prepare("UPDATE usuarios SET tipo_comercial = 'empleador' WHERE usuario = 'admin'").run();
  const admin = usuario(1, 'Administrador', 'admin');
  const carlos = usuario(2, 'Carlos Vendedor', 'vendedor');
  const luisa = usuario(3, 'Luisa Cajera', 'cajero');

  setConfig(db, 'negocio_nombre', 'SEGY');
  setConfig(db, 'negocio_nit', '901.234.567-8');
  setConfig(db, 'negocio_direccion', 'Calle 30 # 28-15, Centro');
  setConfig(db, 'negocio_ciudad', 'Palmira, Valle');
  setConfig(db, 'negocio_telefono', '318 000 0000');

  productos.asegurarCategorias(db);
  const cat = (nombre) => db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre).id;

  // Proveedores
  const insProv = db.prepare('INSERT INTO proveedores(nombre, identificacion, telefono, email, direccion, contacto) VALUES (?,?,?,?,?,?)');
  insProv.run('Importadora Celumax', '900.111.222-1', '601 555 0101', 'ventas@celumax.co', 'Bogotá, San Andresito', 'Diana Ruiz');
  insProv.run('Distribuidora TecnoAndina', '900.333.444-5', '602 555 0202', 'pedidos@tecnoandina.co', 'Cali, Centro', 'Jorge Mora');
  insProv.run('Mayorista Mobile Parts', '79.555.666', '310 555 0303', null, 'Medellín, El Hueco', 'Mauricio');

  // Clientes
  const insCli = db.prepare('INSERT INTO clientes(nombre, telefono, identificacion, direccion) VALUES (?,?,?,?)');
  insCli.run('Ana María Torres', '3001234567', '1.112.345.678', 'Barrio Las Mercedes');
  insCli.run('Jhon Jairo Pérez', '3109876543', '94.123.456', 'Barrio Zamorano');
  insCli.run('Valentina Gómez', '3155550001', null, null);
  insCli.run('Taller CelFix', '3175550002', '901.555.111-2', 'Carrera 29 # 30-10');
  insCli.run('Mateo Ramírez', '3205550003', '1.113.000.111', null);
  insCli.run('Sofía Castro', '3015550004', null, 'Barrio Versalles');

  // Productos
  const P = (nombre, categoria, extra = {}) => productos.crear(db, { nombre, categoria_id: cat(categoria), ...extra }, admin).id;
  const ids = {};
  ids.iphone17pm = P('iPhone 17 Pro Max 256GB', 'Celulares nuevos', { marca: 'Apple', capacidad: '256GB', color: 'Titanio', requiere_serial: 1, precio_venta: 4200000, stock_minimo: 1, referencia: 'A3400' });
  ids.iphone15 = P('iPhone 15 128GB', 'Celulares nuevos', { marca: 'Apple', capacidad: '128GB', color: 'Negro', requiere_serial: 1, precio_venta: 2650000, stock_minimo: 1 });
  ids.s24 = P('Samsung Galaxy S24 256GB', 'Celulares nuevos', { marca: 'Samsung', capacidad: '256GB', color: 'Gris', requiere_serial: 1, precio_venta: 2900000, stock_minimo: 1 });
  ids.a15 = P('Samsung Galaxy A15 128GB', 'Celulares nuevos', { marca: 'Samsung', capacidad: '128GB', color: 'Azul', requiere_serial: 1, precio_venta: 720000, stock_minimo: 2 });
  ids.redmi = P('Xiaomi Redmi Note 13 256GB', 'Celulares nuevos', { marca: 'Xiaomi', capacidad: '256GB', color: 'Verde', requiere_serial: 1, precio_venta: 890000, stock_minimo: 2 });
  ids.iphone12u = P('iPhone 12 64GB usado (grado A)', 'Celulares usados', { marca: 'Apple', capacidad: '64GB', color: 'Blanco', requiere_serial: 1, precio_venta: 1150000, stock_minimo: 0 });
  ids.estuche17 = P('Estuche transparente antigolpes iPhone 17', 'Estuches', { marca: 'Genérico', modelo_compatible: 'iPhone 17', precio_venta: 25000, stock_minimo: 5, codigo_barras: '7701234000011' });
  ids.estucheA15 = P('Estuche silicona Galaxy A15', 'Estuches', { marca: 'Genérico', modelo_compatible: 'Galaxy A15', color: 'Negro', precio_venta: 18000, stock_minimo: 5, codigo_barras: '7701234000028' });
  ids.vidrio17 = P('Vidrio templado 9D iPhone 17', 'Vidrios templados', { modelo_compatible: 'iPhone 17', precio_venta: 15000, stock_minimo: 10, codigo_barras: '7701234000035' });
  ids.vidrioA15 = P('Vidrio templado Galaxy A15', 'Vidrios templados', { modelo_compatible: 'Galaxy A15', precio_venta: 12000, stock_minimo: 10, codigo_barras: '7701234000042' });
  ids.cargador20 = P('Cargador 20W USB-C carga rápida', 'Cargadores', { marca: 'Genérico', precio_venta: 35000, stock_minimo: 5, codigo_barras: '7701234000059' });
  ids.cargadorApple = P('Cargador Apple 20W original', 'Cargadores', { marca: 'Apple', precio_venta: 95000, stock_minimo: 2, codigo_barras: '7701234000066' });
  ids.cableC = P('Cable USB-C a USB-C 1m', 'Cables', { precio_venta: 20000, stock_minimo: 10, codigo_barras: '7701234000073' });
  ids.cableL = P('Cable Lightning 1m certificado', 'Cables', { precio_venta: 28000, stock_minimo: 10, codigo_barras: '7701234000080' });
  ids.audif = P('Audífonos inalámbricos TWS Pro', 'Audífonos', { marca: 'Genérico', color: 'Blanco', precio_venta: 65000, stock_minimo: 3, codigo_barras: '7701234000097' });
  ids.airpods = P('AirPods Pro 2', 'Accesorios para iPhone', { marca: 'Apple', precio_venta: 950000, stock_minimo: 1, requiere_serial: 1 });
  ids.power = P('Power bank 10.000 mAh', 'Power banks', { marca: 'Genérico', precio_venta: 75000, stock_minimo: 3, codigo_barras: '7701234000103' });
  ids.soporte = P('Soporte para carro magnético', 'Soportes', { precio_venta: 30000, stock_minimo: 3, codigo_barras: '7701234000110' });
  ids.pantallaA15 = P('Pantalla Galaxy A15 (repuesto)', 'Repuestos', { modelo_compatible: 'Galaxy A15', precio_venta: 180000, stock_minimo: 1 });
  ids.bateria12 = P('Batería iPhone 12 (repuesto)', 'Repuestos', { modelo_compatible: 'iPhone 12', precio_venta: 120000, stock_minimo: 1 });
  ids.pinC = P('Pin de carga USB-C (repuesto)', 'Repuestos', { precio_venta: 25000, stock_minimo: 5 });
  ids.sim = P('Adaptador SIM + extractor', 'Otros productos', { precio_venta: 5000, stock_minimo: 10 });
  ids.manos = P('Manos libres alámbricos 3.5mm', 'Audífonos', { precio_venta: 15000, stock_minimo: 5, codigo_barras: '7701234000127' });
  ids.popsocket = P('Popsocket / anillo soporte', 'Soportes', { precio_venta: 10000, stock_minimo: 5 });

  const h = hoy();
  const d = (n) => sumarDias(h, -n);

  // Compras (lotes con distintos costos)
  compras.crear(db, { proveedor_id: 1, fecha: d(45), numero_factura: 'FV-10234', items: [
    { producto_id: ids.iphone17pm, cantidad: 1, costo_unitario: 3300000, seriales: ['352001000000011'] },
    { producto_id: ids.iphone15, cantidad: 2, costo_unitario: 2150000, seriales: ['352002000000022', '352002000000023'] },
    { producto_id: ids.airpods, cantidad: 2, costo_unitario: 720000, seriales: ['AP2-0001', 'AP2-0002'] },
    { producto_id: ids.cargadorApple, cantidad: 5, costo_unitario: 62000 },
  ], valor_pagado: 6000000, metodo_pago: 'transferencia', fecha_vencimiento: d(15) }, admin);
  compras.crear(db, { proveedor_id: 2, fecha: d(40), numero_factura: 'TA-5511', items: [
    { producto_id: ids.estuche17, cantidad: 20, costo_unitario: 8000 },
    { producto_id: ids.estucheA15, cantidad: 15, costo_unitario: 6000 },
    { producto_id: ids.vidrio17, cantidad: 40, costo_unitario: 3500 },
    { producto_id: ids.vidrioA15, cantidad: 30, costo_unitario: 3000 },
    { producto_id: ids.cargador20, cantidad: 15, costo_unitario: 14000 },
    { producto_id: ids.cableC, cantidad: 30, costo_unitario: 6500 },
    { producto_id: ids.cableL, cantidad: 25, costo_unitario: 9000 },
    { producto_id: ids.audif, cantidad: 10, costo_unitario: 28000 },
    { producto_id: ids.power, cantidad: 8, costo_unitario: 38000 },
    { producto_id: ids.soporte, cantidad: 10, costo_unitario: 12000 },
    { producto_id: ids.manos, cantidad: 20, costo_unitario: 5500 },
    { producto_id: ids.popsocket, cantidad: 30, costo_unitario: 3000 },
    { producto_id: ids.sim, cantidad: 20, costo_unitario: 1200 },
  ], costos_adicionales: 60000, valor_pagado: 1900000, metodo_pago: 'transferencia', notas: 'Incluye flete Cali-Palmira (se prorratea en el costo de cada lote)' }, admin);
  compras.crear(db, { proveedor_id: 3, fecha: d(35), numero_factura: 'MP-889', items: [
    { producto_id: ids.pantallaA15, cantidad: 3, costo_unitario: 95000 },
    { producto_id: ids.bateria12, cantidad: 4, costo_unitario: 55000 },
    { producto_id: ids.pinC, cantidad: 10, costo_unitario: 7000 },
    { producto_id: ids.a15, cantidad: 3, costo_unitario: 560000, seriales: ['352003000000031', '352003000000032', '352003000000033'] },
    { producto_id: ids.redmi, cantidad: 2, costo_unitario: 690000, seriales: ['352004000000041', '352004000000042'] },
  ], valor_pagado: 3000000, metodo_pago: 'efectivo', fecha_vencimiento: d(-10) }, admin);
  // Segunda compra del iPhone 17 Pro Max a otro costo (ejemplo del brief) + S24
  compras.crear(db, { proveedor_id: 1, fecha: d(30), numero_factura: 'FV-10301', items: [
    { producto_id: ids.iphone17pm, cantidad: 1, costo_unitario: 3100000, seriales: ['352001000000012'] },
    { producto_id: ids.s24, cantidad: 2, costo_unitario: 2250000, seriales: ['352005000000051', '352005000000052'] },
  ], valor_pagado: 7600000, metodo_pago: 'transferencia' }, admin);
  compras.crear(db, { proveedor_nuevo: { nombre: 'Juan Usados (particular)', telefono: '3000000000' }, fecha: d(20), items: [
    { producto_id: ids.iphone12u, cantidad: 1, costo_unitario: 800000, seriales: ['352006000000061'] },
  ], valor_pagado: 800000, metodo_pago: 'efectivo', notas: 'Equipo usado comprado a particular, con caja y cargador' }, admin);
  // Compra reciente de estuches a precio distinto (segundo lote)
  compras.crear(db, { proveedor_id: 2, fecha: d(7), numero_factura: 'TA-5602', items: [
    { producto_id: ids.estuche17, cantidad: 10, costo_unitario: 9000 },
    { producto_id: ids.vidrio17, cantidad: 20, costo_unitario: 3200 },
    { producto_id: ids.cargador20, cantidad: 10, costo_unitario: 13500 },
  ], valor_pagado: 0, fecha_vencimiento: d(-23) }, admin);

  // Ventas históricas (sin caja abierta)
  const V = (dias, u, datos) => ventas.crear(db, { fecha: d(dias), ...datos }, u);
  V(28, carlos, { items: [{ producto_id: ids.estuche17, cantidad: 2 }, { producto_id: ids.vidrio17, cantidad: 2 }], pagos: [{ metodo_pago: 'efectivo', valor: 80000 }] });
  V(27, carlos, { cliente_id: 1, items: [{ producto_id: ids.iphone15, cantidad: 1, seriales: ['352002000000022'] }, { producto_id: ids.vidrio17, cantidad: 1 }, { producto_id: ids.estuche17, cantidad: 1 }],
    pagos: [{ metodo_pago: 'transferencia', valor: 1000000 }], credito: { numero_cuotas: 4, frecuencia: 'quincenal', primera_fecha: d(12), condiciones: 'Pagos quincenales, sin interés' } });
  V(25, luisa, { items: [{ producto_id: ids.cargador20, cantidad: 1 }, { producto_id: ids.cableC, cantidad: 1 }], pagos: [{ metodo_pago: 'nequi', valor: 55000 }] });
  V(24, carlos, { cliente_id: 2, items: [{ producto_id: ids.a15, cantidad: 1, seriales: ['352003000000031'] }, { producto_id: ids.estucheA15, cantidad: 1 }, { producto_id: ids.vidrioA15, cantidad: 1 }],
    pagos: [{ metodo_pago: 'efectivo', valor: 750000 }] });
  V(22, carlos, { cliente_id: 3, items: [{ producto_id: ids.audif, cantidad: 1 }], pagos: [{ metodo_pago: 'daviplata', valor: 65000 }] });
  V(20, luisa, { cliente_id: 4, items: [{ producto_id: ids.pantallaA15, cantidad: 2 }, { producto_id: ids.bateria12, cantidad: 2 }, { producto_id: ids.pinC, cantidad: 5 }], pagos: [{ metodo_pago: 'transferencia', valor: 400000 }],
    credito: { numero_cuotas: 2, frecuencia: 'mensual', primera_fecha: d(-10) } });
  V(18, carlos, { cliente_id: 5, items: [{ producto_id: ids.iphone17pm, cantidad: 1, seriales: ['352001000000011'] }], pagos: [{ metodo_pago: 'transferencia', valor: 2200000 }],
    credito: { numero_cuotas: 4, frecuencia: 'mensual', primera_fecha: d(-5), interes_pct: 0, condiciones: 'Cuota inicial 2.200.000, saldo en 4 cuotas mensuales' } });
  V(15, luisa, { items: [{ producto_id: ids.power, cantidad: 1 }, { producto_id: ids.soporte, cantidad: 1 }, { producto_id: ids.popsocket, cantidad: 2 }], pagos: [{ metodo_pago: 'efectivo', valor: 125000 }] });
  V(12, carlos, { cliente_id: 6, items: [{ producto_id: ids.redmi, cantidad: 1, seriales: ['352004000000041'] }], pagos: [], credito: { numero_cuotas: 3, frecuencia: 'mensual', primera_fecha: d(-2) } });
  V(10, carlos, { items: [{ producto_id: ids.cableL, cantidad: 2 }, { producto_id: ids.manos, cantidad: 1 }], pagos: [{ metodo_pago: 'efectivo', valor: 71000 }] });
  V(8, luisa, { cliente_id: 1, items: [{ producto_id: ids.cargadorApple, cantidad: 1 }], pagos: [{ metodo_pago: 'efectivo', valor: 95000 }] });
  V(5, carlos, { items: [{ producto_id: ids.estuche17, cantidad: 3 }, { producto_id: ids.vidrio17, cantidad: 3 }], pagos: [{ metodo_pago: 'nequi', valor: 120000 }] });
  V(3, carlos, { cliente_id: 2, items: [{ producto_id: ids.airpods, cantidad: 1, seriales: ['AP2-0001'] }], pagos: [{ metodo_pago: 'tarjeta', valor: 950000 }] });
  V(2, luisa, { items: [{ producto_id: ids.cargador20, cantidad: 2 }, { producto_id: ids.cableC, cantidad: 2 }], pagos: [{ metodo_pago: 'efectivo', valor: 110000 }] });

  // Abonos a créditos
  const creditoAna = db.prepare('SELECT id FROM creditos WHERE cliente_id = 1 ORDER BY id LIMIT 1').get().id;
  creditos.abonar(db, creditoAna, { valor: 200000, metodo_pago: 'efectivo', fecha: d(12) }, luisa);
  creditos.abonar(db, creditoAna, { valor: 150000, metodo_pago: 'nequi', fecha: d(1), referencia: 'NQ-77821' }, luisa);
  const creditoMateo = db.prepare('SELECT id FROM creditos WHERE cliente_id = 5 ORDER BY id LIMIT 1').get().id;
  creditos.abonar(db, creditoMateo, { valor: 500000, metodo_pago: 'transferencia', fecha: d(4), referencia: 'BC-10293' }, luisa);

  // Devolución de un vidrio de la venta de hace 5 días
  const ventaDev = db.prepare("SELECT v.id FROM ventas v WHERE v.fecha LIKE ? ORDER BY v.id LIMIT 1").get(d(5) + '%');
  if (ventaDev) {
    const item = db.prepare('SELECT id FROM venta_items WHERE venta_id = ? AND producto_id = ?').get(ventaDev.id, ids.vidrio17);
    if (item) ventas.devolver(db, ventaDev.id, { items: [{ venta_item_id: item.id, cantidad: 1 }], motivo: 'Vidrio llegó rayado', reintegro_metodo: 'efectivo' }, luisa);
  }

  // Gastos
  gastos.crear(db, { categoria: 'Arriendo', descripcion: 'Arriendo local octubre', valor: 1200000, metodo_pago: 'transferencia', fecha: d(9) }, admin);
  gastos.crear(db, { categoria: 'Servicios públicos', descripcion: 'Energía', valor: 180000, metodo_pago: 'efectivo', fecha: d(6) }, admin);
  gastos.crear(db, { categoria: 'Transporte', descripcion: 'Envío mercancía Cali', valor: 45000, metodo_pago: 'efectivo', fecha: d(7) }, luisa);
  gastos.crear(db, { categoria: 'Publicidad', descripcion: 'Pauta Instagram', valor: 60000, metodo_pago: 'tarjeta', fecha: d(4) }, admin);

  // Caja de hoy abierta con ventas del día
  caja.abrir(db, { base_inicial: 200000, notas: 'Apertura de prueba' }, luisa);
  V(0, carlos, { items: [{ producto_id: ids.estuche17, cantidad: 1 }, { producto_id: ids.vidrio17, cantidad: 1 }], pagos: [{ metodo_pago: 'efectivo', valor: 40000 }] });
  V(0, luisa, { cliente_id: 3, items: [{ producto_id: ids.s24, cantidad: 1, seriales: ['352005000000051'] }, { producto_id: ids.cableC, cantidad: 1 }], pagos: [{ metodo_pago: 'transferencia', valor: 1500000 }, { metodo_pago: 'efectivo', valor: 500000 }],
    credito: { numero_cuotas: 2, frecuencia: 'quincenal', primera_fecha: d(-15) } });
  V(0, carlos, { items: [{ producto_id: ids.audif, cantidad: 1 }, { producto_id: ids.cargador20, cantidad: 1 }], pagos: [{ metodo_pago: 'nequi', valor: 100000 }] });
  gastos.crear(db, { categoria: 'Otros gastos', descripcion: 'Bolsas y empaques', valor: 12000, metodo_pago: 'efectivo' }, luisa);

  log('Datos de prueba creados.');
  log('Usuarios: admin / Demo2026*Segy  ·  carlos / Vendedor2026* (vendedor)  ·  luisa / Cajera2026* (cajera)  ·  pedro / Inventario2026*  ·  conta / Consulta2026*');
}

if (require.main === module) {
  const forzar = process.argv.includes('--forzar');
  if (config.PRODUCCION && !process.argv.includes('--permitir-produccion')) {
    console.error('Los datos de demostración no se cargan en producción (crean usuarios con contraseñas conocidas).\nPara el primer administrador usa INITIAL_ADMIN_USER / INITIAL_ADMIN_PASSWORD o `npm run crear-admin`.');
    process.exit(1);
  }
  asegurarCarpetas();
  if (forzar && fs.existsSync(DB_PATH)) {
    for (const suf of ['', '-wal', '-shm']) { try { fs.unlinkSync(DB_PATH + suf); } catch { /* no existe */ } }
    console.log('Base de datos anterior eliminada.');
  }
  const db = getDb();
  if (db.prepare('SELECT COUNT(*) n FROM usuarios').get().n > 0) {
    console.log(`La base ${DB_PATH} ya tiene datos. Usa --forzar para recrearla.`);
    process.exit(0);
  }
  sembrar(db);
  console.log('Base de datos:', DB_PATH);
}

module.exports = { sembrar };
