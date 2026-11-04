'use strict';
// Tienda web: catálogo público (sin costos), publicación desde el panel, pedidos con validación de stock y precios del
// servidor, enlace privado del pedido, solicitudes que entran como clientes potenciales, permisos y servido por dominio.
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, detener, Cliente, CLAVES, getDb } = require('./ayuda');
const tienda = require('../server/services/tienda');

let base = '';
test.before(async () => { base = await iniciar(); });
test.after(detener);
test.beforeEach(() => tienda.reiniciarLimites());

const publico = (ruta, opciones = {}) => fetch(base + '/api/publico/tienda' + ruta, opciones).then(async (r) => ({ status: r.status, datos: await r.json(), headers: r.headers }));
const enviar = (ruta, cuerpo) => publico(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
const CLIENTE = { nombre: 'Laura Restrepo', telefono: '316 555 0101', email: 'laura@ejemplo.com' };

test('catálogo público: grupos, insignia y nunca expone costos', async () => {
  const r = await publico('/inicio');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(r.datos.grupos.map((g) => g.clave), ['celulares', 'usados', 'accesorios', 'repuestos']);
  assert.ok(r.datos.grupos.find((g) => g.clave === 'celulares').total >= 5);
  assert.match(r.datos.insignia.nombre, /iPhone 17 Pro Max/);
  assert.ok(r.datos.insignia.compatibles.some((a) => /iPhone 17/.test(a.nombre)), 'el iPhone 17 Pro Max sugiere sus accesorios compatibles');
  assert.ok(r.datos.destacados.length > 0);
  const lista = await publico('/productos?grupo=accesorios&limite=60');
  assert.equal(lista.status, 200);
  const texto = JSON.stringify([r.datos, lista.datos]);
  for (const prohibido of ['precio_compra', 'costo_unitario', 'valor_costo', 'proveedor', 'margen', '"stock"', 'lote']) assert.ok(!texto.includes(prohibido), `no debe exponer ${prohibido}`);
  assert.ok(lista.datos.productos.every((p) => p.disponibles <= 10), 'las existencias visibles tienen tope');
  const usado = (await publico('/productos?grupo=usados')).datos.productos[0];
  assert.equal(usado.grado, 'A');
});

test('búsqueda, filtros y detalle por slug', async () => {
  const r = await publico('/productos?q=vidrio%20iphone');
  assert.ok(r.datos.productos.length >= 1);
  assert.ok(r.datos.productos.every((p) => /vidrio/i.test(p.nombre)));
  const det = await publico('/productos/' + r.datos.productos[0].slug);
  assert.equal(det.status, 200);
  assert.equal(det.datos.id, r.datos.productos[0].id);
  assert.equal((await publico('/productos/no-existe-99999')).status, 404);
  const caros = await publico('/productos?grupo=celulares&orden=precio_desc');
  const precios = caros.datos.productos.map((p) => p.precio);
  assert.deepEqual(precios, [...precios].sort((a, b) => b - a));
});

test('el panel publica, oculta y marca ofertas', async () => {
  const c = new Cliente();
  await c.entrar('admin', CLAVES.admin);
  const lista = await c.get('/api/tienda/productos?q=popsocket');
  const pop = lista.datos.productos[0];
  assert.equal(pop.visible, true);
  assert.equal((await c.put(`/api/tienda/productos/${pop.id}`, { publicado: false })).status, 200);
  assert.equal((await publico(`/productos/${pop.slug}`)).status, 404);
  assert.equal((await c.put(`/api/tienda/productos/${pop.id}`, { publicado: true, destacado: true, precio_antes: 5000 })).status, 400, 'el precio antes debe ser mayor');
  assert.equal((await c.put(`/api/tienda/productos/${pop.id}`, { publicado: true, destacado: true, precio_antes: 14000 })).status, 200);
  const det = await publico(`/productos/${pop.slug}`);
  assert.equal(det.datos.precio_antes, 14000);
  assert.equal(det.datos.destacado, true);
  // Un vendedor ve pedidos pero no configura productos.
  const v = new Cliente();
  await v.entrar('carlos', CLAVES.carlos);
  assert.equal((await v.get('/api/tienda/pedidos')).status, 200);
  assert.equal((await v.put(`/api/tienda/productos/${pop.id}`, { publicado: false })).status, 403);
  assert.equal((await new Cliente().get('/api/tienda/pedidos')).status, 401);
});

test('pedido web: precios del servidor, stock, lead y seguimiento privado', async () => {
  const db = getDb();
  const cargador = db.prepare("SELECT p.id, p.precio_venta, s.stock FROM productos p JOIN v_stock s ON s.producto_id = p.id WHERE p.nombre LIKE 'Cargador 20W%'").get();
  const sinDatos = await enviar('/pedidos', { cliente: CLIENTE, items: [{ producto_id: cargador.id, cantidad: 1 }] });
  assert.equal(sinDatos.status, 400, 'exige autorización de datos');
  const exceso = await enviar('/pedidos', { acepta_datos: true, cliente: CLIENTE, items: [{ producto_id: cargador.id, cantidad: cargador.stock + 1 > 10 ? 10 : cargador.stock + 1 }], precio: 1 });
  if (cargador.stock < 10) assert.equal(exceso.status, 400);
  const r = await enviar('/pedidos', {
    acepta_datos: true, cliente: CLIENTE, entrega: { tipo: 'local', direccion: 'Calle 31 # 29-40', barrio: 'Centro' }, pago: 'contraentrega',
    items: [{ producto_id: cargador.id, cantidad: 2, precio: 1 }], utm_source: 'meta', utm_campaign: 'prueba', visitante: 'vtest123',
  });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  assert.match(r.datos.numero, /^TW-\d{6}$/);
  assert.equal(r.datos.subtotal, cargador.precio_venta * 2, 'el precio lo pone el servidor, no el navegador');
  assert.equal(r.datos.envio_por_confirmar, true);
  const seguimiento = await publico('/pedidos/' + r.datos.token);
  assert.equal(seguimiento.status, 200);
  assert.equal(seguimiento.datos.estado, 'nuevo');
  assert.equal(seguimiento.datos.nombre, 'Laura');
  assert.ok(!JSON.stringify(seguimiento.datos).includes('316 555'), 'el enlace no muestra el teléfono');
  assert.equal((await publico('/pedidos/' + 'f'.repeat(32))).status, 404);
  const pedido = db.prepare('SELECT * FROM tienda_pedidos WHERE numero = ?').get(r.datos.numero);
  const lead = db.prepare('SELECT * FROM marketing_leads WHERE id = ?').get(pedido.lead_id);
  assert.equal(lead.canal, 'web');
  assert.equal(lead.utm_source, 'meta');
  assert.match(lead.mensaje, /TW-\d{6}/);

  // Gestión en el panel: estados, motivo obligatorio para cancelar, vínculo con una venta real.
  const c = new Cliente();
  await c.entrar('luisa', CLAVES.luisa);
  const lista = await c.get('/api/tienda/pedidos?estado=abiertos');
  assert.ok(lista.datos.pedidos.some((p) => p.id === pedido.id));
  assert.equal((await c.post(`/api/tienda/pedidos/${pedido.id}/estado`, { estado: 'confirmado' })).status, 200);
  assert.equal((await c.post(`/api/tienda/pedidos/${pedido.id}/estado`, { estado: 'cancelado' })).status, 400);
  assert.equal((await c.put(`/api/tienda/pedidos/${pedido.id}`, { venta_numero: 'NO-EXISTE' })).status, 404);
  const venta = db.prepare('SELECT numero FROM ventas LIMIT 1').get();
  const vinc = await c.put(`/api/tienda/pedidos/${pedido.id}`, { venta_numero: venta.numero.toLowerCase(), notas_internas: 'Cliente confirmó por WhatsApp' });
  assert.equal(vinc.status, 200);
  assert.equal(vinc.datos.venta_numero, venta.numero);
  assert.equal((await c.post(`/api/tienda/pedidos/${pedido.id}/estado`, { estado: 'entregado' })).status, 200);
  assert.equal((await c.post(`/api/tienda/pedidos/${pedido.id}/estado`, { estado: 'nuevo' })).status, 409, 'un pedido entregado no cambia');
  assert.equal((await publico('/pedidos/' + r.datos.token)).datos.historial.length, 3);
});

test('reglas de pago y entrega, y límite por IP', async () => {
  const id = getDb().prepare("SELECT id FROM productos WHERE nombre LIKE 'Cable USB-C%'").get().id;
  const pedido = (extra) => enviar('/pedidos', { acepta_datos: true, cliente: CLIENTE, items: [{ producto_id: id, cantidad: 1 }], ...extra });
  assert.equal((await pedido({ pago: 'contraentrega', entrega: { tipo: 'recoger' } })).status, 400);
  assert.equal((await pedido({ pago: 'credito', credito_cuotas: 7 })).status, 400);
  assert.equal((await pedido({ entrega: { tipo: 'nacional', direccion: 'Cra 1' } })).status, 400, 'pide la ciudad');
  const estados = [];
  for (let i = 0; i < 6; i++) estados.push((await pedido({ pago: 'tienda', entrega: { tipo: 'recoger' } })).status);
  assert.deepEqual(estados, [201, 201, 201, 201, 201, 429]);
});

test('solicitudes de retoma y crédito entran como clientes potenciales', async () => {
  const r = await enviar('/solicitudes', { tipo: 'retoma', acepta_datos: true, ...CLIENTE, datos: { Marca: 'Apple', Modelo: 'iPhone 13', 'Batería': '86 %' }, mensaje: '<b>hola</b>' });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  const lead = getDb().prepare("SELECT * FROM marketing_leads WHERE mensaje LIKE '[Retoma%' ORDER BY id DESC").get();
  assert.match(lead.mensaje, /iPhone 13/);
  assert.equal((await enviar('/solicitudes', { tipo: 'otra', acepta_datos: true, ...CLIENTE })).status, 400);
  assert.equal((await enviar('/solicitudes', { tipo: 'credito', acepta_datos: true, ...CLIENTE, telefono: '12' })).status, 400);
});

test('ajustes de la tienda y dominio de la tienda', async () => {
  const c = new Cliente();
  await c.entrar('admin', CLAVES.admin);
  const a = await c.put('/api/tienda/ajustes', { whatsapp: '57 318 000 0000', envio: { local_costo: 8000, gratis_desde: 300000 }, credito: { planes: [{ cuotas: 6, interes_pct: 5 }, { cuotas: 12, interes_pct: 9 }] }, redes: { instagram: 'http://inseguro' } });
  assert.equal(a.status, 400, 'las redes deben ser https');
  const b = await c.put('/api/tienda/ajustes', { whatsapp: '57 318 000 0000', envio: { local_costo: 8000, gratis_desde: 300000 }, credito: { planes: [{ cuotas: 6, interes_pct: 5 }, { cuotas: 12, interes_pct: 9 }] } });
  assert.equal(b.status, 200, JSON.stringify(b.datos));
  assert.equal(b.datos.whatsapp_efectivo, '573180000000');
  const ini = await publico('/inicio');
  assert.deepEqual(ini.datos.tienda.credito.planes.map((p) => p.cuotas), [6, 12]);
  assert.equal(ini.datos.negocio.whatsapp, '573180000000');
  // En el dominio de la tienda no se entrega el panel (y la API sigue respondiendo).
  const pedirConHost = (host) => new Promise((ok, mal) => {
    const u = new URL(base + '/catalogo/celulares');
    require('node:http').get({ hostname: u.hostname, port: u.port, path: u.pathname, headers: { Host: host } }, (res) => { let t = ''; res.on('data', (d) => { t += d; }); res.on('end', () => ok(t)); }).on('error', mal);
  });
  assert.ok(!(await pedirConHost('tienda.localhost')).includes('Panel de gestión'), 'el dominio de la tienda no muestra el panel');
  assert.ok((await pedirConHost('127.0.0.1')).length > 0);
});
