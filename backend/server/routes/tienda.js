'use strict';
// Tienda web.
//  - `publico` se monta en /api/publico/tienda SIN sesión: catálogo, fotos de productos publicados, pedidos y solicitudes.
//    Acepta CORS (la tienda puede publicarse en otro dominio), usa su propio parser JSON de 32 kB y nunca devuelve costos,
//    proveedores ni datos de otros clientes.
//  - `router` se monta en /api con sesión: pedidos, productos publicados y ajustes, según los permisos tienda.*.
const express = require('express');
const { getDb } = require('../db');
const { requierePermiso } = require('../auth');
const archivos = require('../services/archivos');
const tienda = require('../services/tienda');

const router = express.Router();
const publico = express.Router();
const id = (req) => Number(req.params.id);
const cuerpo = (req) => (req.body && typeof req.body === 'object' ? req.body : {});
const LIMITE_CUERPO = '32kb';

// ---------- Público ----------
publico.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
publico.use(express.json({ limit: LIMITE_CUERPO }));
// Respuestas de catálogo: caché corta en el navegador y en el CDN (el inventario cambia durante el día).
const cacheCorta = (res) => res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');

publico.get('/inicio', (req, res) => { cacheCorta(res); res.json(tienda.inicio(getDb())); });
publico.get('/productos', (req, res) => {
  const q = req.query;
  cacheCorta(res);
  res.json(tienda.listarPublico(getDb(), { q: q.q, grupo: q.grupo, categoria: q.categoria, marca: q.marca, compatible: q.compatible, min: q.min, max: q.max, disponible: q.disponible, destacados: q.destacados, ofertas: q.ofertas, orden: q.orden, limite: q.limite, pagina: q.pagina }));
});
publico.get('/productos/:slug', (req, res) => { cacheCorta(res); res.json(tienda.obtenerPublico(getDb(), req.params.slug)); });
publico.get('/fotos/:id', (req, res) => {
  const f = tienda.fotoPublica(getDb(), id(req));
  const abs = archivos.rutaAbsoluta(f.ruta);
  res.sendFile(abs, { headers: { 'Cache-Control': 'public, max-age=86400', 'Content-Type': archivos.mimeDe(abs), 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } }, (e) => {
    if (e && !res.headersSent) res.status(404).json({ error: 'Foto no encontrada', codigo: 'no_encontrado' });
  });
});
publico.post('/pedidos', (req, res) => res.status(201).json(tienda.crearPedido(getDb(), cuerpo(req), { ip: req.ip })));
publico.get('/pedidos/:token', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(tienda.pedidoPublico(getDb(), req.params.token)); });
publico.post('/solicitudes', (req, res) => res.status(201).json(tienda.crearSolicitud(getDb(), cuerpo(req), { ip: req.ip })));
publico.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada', codigo: 'no_encontrado' }));

// ---------- Panel ----------
const ver = requierePermiso('tienda.ver', 'tienda.gestionar', 'tienda.configurar');
router.get('/tienda/resumen', ver, (req, res) => res.json(tienda.resumen(getDb())));
router.get('/tienda/pedidos', ver, (req, res) => res.json(tienda.listarPedidos(getDb(), { estado: req.query.estado, q: req.query.q, limite: req.query.limite })));
router.get('/tienda/pedidos/:id', ver, (req, res) => res.json(tienda.obtenerPedido(getDb(), id(req))));
router.post('/tienda/pedidos/:id/estado', requierePermiso('tienda.gestionar'), (req, res) => { const b = cuerpo(req); res.json(tienda.cambiarEstadoPedido(getDb(), id(req), b.estado, b.nota, req.usuario)); });
router.put('/tienda/pedidos/:id', requierePermiso('tienda.gestionar'), (req, res) => res.json(tienda.actualizarPedido(getDb(), id(req), cuerpo(req), req.usuario)));
router.get('/tienda/productos', ver, (req, res) => res.json(tienda.listarProductosWeb(getDb(), { q: req.query.q, categoria_id: req.query.categoria_id, filtro: req.query.filtro })));
router.put('/tienda/productos/:id', requierePermiso('tienda.configurar'), (req, res) => res.json(tienda.guardarProductoWeb(getDb(), id(req), cuerpo(req), req.usuario)));
router.get('/tienda/ajustes', ver, (req, res) => res.json(tienda.ajustesPanel(getDb())));
router.put('/tienda/ajustes', requierePermiso('tienda.configurar'), (req, res) => res.json(tienda.guardarAjustes(getDb(), cuerpo(req), req.usuario)));

module.exports = { router, publico };
