'use strict';
// Recepción de celulares usados: borradores, inspección, fotos, valoración, aprobación, destino y costos.
const express = require('express');
const { getDb } = require('../db');
const { requierePermiso } = require('../auth');
const usados = require('../services/usados');

const router = express.Router();
const id = (req) => Number(req.params.id);

router.get('/usados/catalogo', requierePermiso('usados.ver', 'usados.registrar'), (req, res) => res.json(usados.catalogo(getDb())));
router.get('/usados/resumen', requierePermiso('usados.ver', 'usados.registrar'), (req, res) => res.json(usados.resumen(getDb())));
router.get('/usados/en-venta', requierePermiso('ventas.crear'), (req, res) => res.json(usados.disponiblesVenta(getDb(), req.query.q)));
router.get('/usados/parte-de-pago', requierePermiso('ventas.crear'), (req, res) => res.json(usados.disponiblesParteDePago(getDb(), req.query.q)));
// Simulación de la valoración (sin guardar): la interfaz la usa para mostrar el resultado en vivo en el paso 3.
router.post('/usados/valorar', requierePermiso('usados.ver', 'usados.registrar'), (req, res) => res.json(usados.valorar(usados.configValoracion(getDb()), req.body || {})));
router.get('/usados', requierePermiso('usados.ver', 'usados.registrar'), (req, res) => {
  const q = req.query;
  res.json(usados.listar(getDb(), { estado: q.estado, destino: q.destino, q: q.q, empleado_id: q.empleado_id, desde: q.desde, hasta: q.hasta, limite: q.limite }));
});
router.post('/usados', requierePermiso('usados.registrar'), (req, res) => res.status(201).json(usados.crear(getDb(), req.body, req.usuario)));
router.get('/usados/:id', requierePermiso('usados.ver', 'usados.registrar'), (req, res) => res.json(usados.obtener(getDb(), id(req))));
router.put('/usados/:id', requierePermiso('usados.registrar'), (req, res) => res.json(usados.actualizar(getDb(), id(req), req.body, req.usuario)));
router.post('/usados/:id/fotos', requierePermiso('usados.registrar'), (req, res) => res.status(201).json(usados.agregarFoto(getDb(), id(req), req.body, req.usuario)));
router.delete('/usados/:id/fotos/:fotoId', requierePermiso('usados.registrar'), (req, res) => res.json(usados.eliminarFoto(getDb(), id(req), Number(req.params.fotoId), req.usuario)));
router.post('/usados/:id/enviar', requierePermiso('usados.registrar'), (req, res) => res.json(usados.enviar(getDb(), id(req), req.usuario)));
router.post('/usados/:id/aprobar', requierePermiso('usados.registrar'), (req, res) => res.json(usados.aprobar(getDb(), id(req), req.body || {}, req.usuario)));
router.post('/usados/:id/rechazar', requierePermiso('usados.aprobar'), (req, res) => res.json(usados.rechazar(getDb(), id(req), req.body.motivo, req.usuario)));
router.post('/usados/:id/anular', requierePermiso('usados.registrar'), (req, res) => res.json(usados.anular(getDb(), id(req), req.body.motivo, req.usuario)));
router.post('/usados/:id/destino', requierePermiso('usados.registrar'), (req, res) => res.json(usados.cambiarDestino(getDb(), id(req), req.body.destino, req.usuario)));
router.post('/usados/:id/costos', requierePermiso('usados.registrar'), (req, res) => res.status(201).json(usados.agregarCosto(getDb(), id(req), req.body, req.usuario)));

module.exports = router;
