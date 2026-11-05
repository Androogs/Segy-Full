'use strict';
// Sube fotos de producto usando la misma lógica del endpoint POST /api/productos/:id/fotos
// (archivos.guardarDesdeBase64 + productos.agregarFoto + auditoría), sin necesidad de sesión.
// Uso:  node scripts/subir-fotos.js
const fs = require('node:fs');
const path = require('node:path');
const { getDb, cerrarDb } = require('../server/db');
const archivos = require('../server/services/archivos');
const productos = require('../server/services/productos');
const auditoria = require('../server/services/auditoria');

const ORIGEN = process.env.FOTOS_DIR || 'C:\\Users\\USUARIO\\Videos\\Nueva carpeta';

// Tanda 4: reemplazo — los mismos productos, ahora en PNG limpio.
const LOTES = [
  { producto: 3, fotos: ['2457389-800-800.jpg'] },
  { producto: 2, fotos: ['iphone15.png'] },
  { producto: 6, fotos: ['iphone_12.png'] },
  { producto: 4, fotos: ['galaxy a15.png'] },
  { producto: 5, fotos: ['redmi_note_13.png'] },
  { producto: 16, fotos: ['airpods pro 2.png'] },
  { producto: 15, fotos: ['tws_pro.png'] },
  { producto: 12, fotos: ['cargador_apple_20w.png'] },
  { producto: 13, fotos: ['cable-usb-c-de-1-m-100-w.png'] },
  { producto: 14, fotos: ['cable lightnin 1m.png'] },
  { producto: 7, fotos: ['estuche_anti_golpes_iphone_17.png'] },
  { producto: 8, fotos: ['estuche_silicona_a15.png'] },
  { producto: 17, fotos: ['powerbank_10000_mah.png'] },
  { producto: 18, fotos: ['soporte_magnetico.png'] },
  { producto: 23, fotos: ['manos_libres_alambrico.png'] },
  { producto: 24, fotos: ['popsocket_anillo_soporte.png'] },
];

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const usuario = { id: 1, nombre: 'Administrador', usuario: 'admin', rol: 'admin', permisos: new Set(['*']) };
const db = getDb();

function subirFoto(productoId, archivo) {
  const ruta = path.join(ORIGEN, archivo);
  const mime = MIME[path.extname(archivo).toLowerCase()] || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${fs.readFileSync(ruta).toString('base64')}`;
  const guardado = archivos.guardarDesdeBase64(dataUrl, mime, archivo);
  const foto = productos.agregarFoto(db, productoId, guardado, usuario);
  auditoria.registrar(db, usuario, 'agregar_foto', 'producto', productoId, { archivo, ruta: guardado.ruta }, 'script-local');
  console.log(`  foto ${archivo} -> foto #${foto.id}${foto.principal ? ' · portada' : ''}`);
}

for (const lote of LOTES) {
  const p = productos.obtener(db, lote.producto);
  console.log(`[${lote.producto}] ${p.nombre}:`);
  for (const f of db.prepare('SELECT * FROM producto_fotos WHERE producto_id = ?').all(lote.producto)) {
    productos.eliminarFoto(db, lote.producto, f.id, usuario);
    archivos.eliminar(f.ruta);
    console.log(`  quitada foto #${f.id}`);
  }
  for (const f of lote.fotos) subirFoto(lote.producto, f);
}

cerrarDb();
console.log('Listo.');
