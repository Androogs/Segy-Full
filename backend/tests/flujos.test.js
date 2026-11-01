'use strict';
// Flujos completos del negocio a través de la API (como los haría la interfaz): catálogo, compra, venta de contado y a
// crédito, abonos, devolución, anulación, caja, gastos, marketing y recepción de usados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, detener, Cliente, CLAVES } = require('./ayuda');

test.before(iniciar);
test.after(detener);

const ok = (r, msg) => assert.ok(r.status >= 200 && r.status < 300, `${msg}: ${r.status} ${JSON.stringify(r.datos).slice(0, 300)}`);

test('flujo completo de operación diaria', async () => {
  const a = new Cliente();
  await a.entrar('admin', CLAVES.admin);

  // Caja
  const cajaActual = (await a.get('/api/caja')).datos;
  if (!cajaActual.abierta) ok(await a.post('/api/caja/abrir', { base_inicial: 100000 }), 'abrir caja');

  // Catálogo
  const p = await a.post('/api/productos', { nombre: 'Estuche prueba flujo', precio_venta: 30000, precio_compra: 10000, stock_minimo: 2 });
  ok(p, 'crear producto');
  const pid = p.datos.id;
  ok(await a.put(`/api/productos/${pid}`, { precio_venta: 32000, motivo_precio: 'Ajuste' }), 'editar producto');

  // Compra en pesos con pago parcial
  const prov = await a.post('/api/proveedores', { nombre: 'Proveedor flujo', telefono: '3000000000' });
  ok(prov, 'crear proveedor');
  const compra = await a.post('/api/compras', { proveedor_id: prov.datos.id, numero_factura: 'F-FLUJO-1', items: [{ producto_id: pid, cantidad: 10, costo_unitario: 11000 }], valor_pagado: 50000, metodo_pago: 'efectivo' });
  ok(compra, 'crear compra');
  ok(await a.post(`/api/compras/${compra.datos.id}/pagos`, { valor: 10000, metodo_pago: 'transferencia' }), 'pagar compra');

  // Compra en dólares
  const usd = await a.post('/api/compras', { moneda: 'USD', tasa_cambio: 4000, tasa_origen: 'manual', tasa_nota: 'Prueba', items: [{ producto_id: pid, cantidad: 2, costo_unitario: 3.5 }], numero_factura: 'F-USD-1' });
  ok(usd, 'compra en USD');
  assert.equal(usd.datos.moneda, 'USD');

  // Ajuste de inventario
  ok(await a.post(`/api/productos/${pid}/ajuste`, { cantidad: -1, motivo: 'Pérdida de prueba', tipo: 'perdida' }), 'ajuste');

  // Cliente y venta de contado
  const cli = await a.post('/api/clientes', { nombre: 'Cliente flujo', telefono: '3115551234' });
  ok(cli, 'crear cliente');
  const v1 = await a.post('/api/ventas', { cliente_id: cli.datos.id, items: [{ producto_id: pid, cantidad: 2 }], pagos: [{ metodo_pago: 'efectivo', valor: 64000 }] });
  ok(v1, 'venta de contado');
  assert.equal(v1.datos.costo_total > 0, true, 'la venta tiene costo FIFO');
  ok(await a.get(`/api/ventas/${v1.datos.id}/pdf`), 'PDF de venta');
  const comp = await a.get(`/comprobante/${v1.datos.token_publico}`);
  assert.equal(comp.status, 200);
  assert.equal((await a.get('/comprobante/no-valido')).status, 404);

  // Devolución parcial
  const item = v1.datos.items[0];
  ok(await a.post(`/api/ventas/${v1.datos.id}/devolucion`, { tipo: 'devolucion', motivo: 'Defecto', items: [{ venta_item_id: item.id, cantidad: 1, reingresa: true }], reintegro_metodo: 'efectivo' }), 'devolución');

  // Venta a crédito y abono
  const v2 = await a.post('/api/ventas', { cliente_id: cli.datos.id, items: [{ producto_id: pid, cantidad: 2 }], pagos: [{ metodo_pago: 'efectivo', valor: 10000 }], credito: { numero_cuotas: 3, frecuencia: 'mensual' } });
  ok(v2, 'venta a crédito');
  const v2d = (await a.get(`/api/ventas/${v2.datos.id}`)).datos;
  if (v2d.credito) {
    ok(await a.post(`/api/creditos/${v2d.credito.id}/abonos`, { valor: 5000, metodo_pago: 'nequi' }), 'abono');
    ok(await a.get(`/api/clientes/${cli.datos.id}/estado-cuenta/pdf`), 'estado de cuenta PDF');
  }

  // Anulación
  const v3 = await a.post('/api/ventas', { items: [{ producto_id: pid, cantidad: 1 }], pagos: [{ metodo_pago: 'efectivo', valor: 32000 }] });
  ok(v3, 'venta para anular');
  ok(await a.post(`/api/ventas/${v3.datos.id}/anular`, { motivo: 'Error de digitación' }), 'anular venta');

  // Gastos y movimientos de caja
  const g = await a.post('/api/gastos', { categoria: 'Transporte', valor: 15000, metodo_pago: 'efectivo', descripcion: 'Domicilio' });
  ok(g, 'gasto');
  ok(await a.del(`/api/gastos/${g.datos.id}`), 'anular gasto');
  ok(await a.post('/api/caja/movimientos', { tipo: 'entrada', valor: 20000, concepto: 'Base extra' }), 'movimiento caja');
  ok(await a.post('/api/caja/cerrar', { efectivo_contado: 500000, notas: 'Cierre de prueba' }), 'cerrar caja');

  // Marketing
  const camp = await a.post('/api/marketing/campanas', { nombre: 'Campaña flujo', plataforma: 'meta', presupuesto: 200000 });
  ok(camp, 'crear campaña');
  ok(await a.post(`/api/marketing/campanas/${camp.datos.id}/metricas`, { fecha: '2026-10-01', gasto: 10000, clics: 30, impresiones: 1000 }), 'métricas');
  const lead = await a.post('/api/marketing/leads', { nombre: 'Interesado', telefono: '3120000000', canal: 'whatsapp', campana_id: camp.datos.id });
  ok(lead, 'crear lead');

  // Usados: recepción en borrador
  const u = await a.post('/api/usados', { marca: 'Apple', modelo: 'iPhone 12', capacidad: '128 GB', imei1: '356938035643809', vendedor_nombre: 'Juan' });
  ok(u, 'recepción de usado');
  ok(await a.put(`/api/usados/${u.datos.id}`, { valor_mercado: 1500000, inspeccion: { pantalla_estado: 'bueno' } }), 'actualizar usado');

  // Configuración y respaldo
  ok(await a.put('/api/configuracion', { negocio_ciudad: 'Palmira' }), 'configuración');
  const resp = await a.post('/api/respaldos');
  ok(resp, 'respaldo');

  // Auditoría registra las acciones
  const aud = (await a.get('/api/auditoria')).datos;
  assert.ok((Array.isArray(aud) ? aud : aud.filas || aud.registros || []).length > 0 || JSON.stringify(aud).includes('crear_producto'));
});
