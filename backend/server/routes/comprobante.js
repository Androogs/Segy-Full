'use strict';
// Comprobante público de venta (enlace compartido por WhatsApp). Solo accesible con el token aleatorio de la venta;
// no se indexa en buscadores y tiene límite de consultas por IP.
const express = require('express');
const { getDb, getConfigTodo } = require('../db');
const { cop, fechaCO } = require('../util');
const ventas = require('../services/ventas');
const pdf = require('../services/pdf');
const limites = require('../limites');

const router = express.Router();
const TOKEN = /^[a-f0-9]{24,64}$/;
router.use(limites.comprobante, (req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Cache-Control', 'private, no-store'); next(); });

router.get('/:token', (req, res) => {
  const db = getDb();
  const v = TOKEN.test(req.params.token) ? ventas.obtenerPorToken(db, req.params.token) : null;
  if (!v) return res.status(404).send('<!doctype html><meta charset="utf-8"><p>Comprobante no encontrado.</p>');
  const cfg = getConfigTodo(db);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const filas = v.items.map((it) => `<tr><td>${esc(it.nombre_producto)}${it.seriales.length ? `<br><small>IMEI: ${esc(it.seriales.join(', '))}</small>` : ''}</td><td class="n">${it.cantidad}</td><td class="n">${cop(it.precio_unitario)}</td><td class="n">${cop(it.total)}</td></tr>`).join('');
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprobante ${esc(v.numero)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:20px;color:#1a1a1a;background:#f2f2f2}.c{max-width:560px;margin:0 auto;background:#fff;border:1px solid #e9e9e9;border-radius:8px;padding:20px}h1{font-size:18px;margin:0}p{margin:4px 0;color:#6d6d6d;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}td,th{padding:8px 4px;border-bottom:1px solid #e9e9e9;text-align:left;vertical-align:top}.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.t{font-size:20px;font-weight:700;text-align:right;margin-top:12px}.a{background:#d80027;color:#fff;padding:8px;border-radius:6px;text-align:center;font-weight:700;margin-top:12px}a.b{display:block;margin-top:16px;background:#1a1a1a;color:#fff;text-decoration:none;text-align:center;padding:12px;border-radius:6px;font-weight:600}</style></head>
<body><div class="c"><h1>${esc(cfg.negocio_nombre)}</h1><p>${esc([cfg.negocio_nit && 'NIT ' + cfg.negocio_nit, cfg.negocio_direccion, cfg.negocio_telefono].filter(Boolean).join(' · '))}</p>
<p><strong>Comprobante ${esc(v.numero)}</strong> · ${fechaCO(v.fecha, true)}</p><p>Cliente: ${esc(v.cliente_nombre || 'Consumidor final')}</p>
<table><thead><tr><th>Producto</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Total</th></tr></thead><tbody>${filas}</tbody></table>
${v.descuento ? `<p class="n">Descuento: -${cop(v.descuento)}</p>` : ''}<div class="t">Total ${cop(v.total)}</div>
${v.credito ? `<p class="n">Saldo a crédito: ${cop(v.credito.saldo_actual)}</p>` : ''}${v.estado === 'anulada' ? '<div class="a">VENTA ANULADA</div>' : ''}
<a class="b" href="/comprobante/${esc(v.token_publico)}/pdf">Descargar PDF</a><p style="text-align:center;margin-top:16px">${esc(cfg.mensaje_comprobante)}</p></div></body></html>`);
});

router.get('/:token/pdf', async (req, res) => {
  const db = getDb();
  const v = TOKEN.test(req.params.token) ? ventas.obtenerPorToken(db, req.params.token) : null;
  if (!v) return res.status(404).send('No encontrado');
  const buffer = await pdf.comprobanteVenta(db, v);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="comprobante-${v.numero}.pdf"`);
  res.send(buffer);
});


module.exports = router;
