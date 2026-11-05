# Quita el fondo blanco de las fotos de producto y las deja como PNG con transparencia.
# Solo borra el blanco conectado con el borde (flood fill), para no comerse partes blancas del producto.
# Uso:  python scripts/fondo-transparente.py
import sqlite3
import sys
from collections import deque
from pathlib import Path

from PIL import Image

BACKEND = Path(__file__).resolve().parent.parent
DB = BACKEND / 'data' / 'segy.db'
UPLOADS = BACKEND / 'data' / 'archivos'

UMBRAL = 236       # canales por encima de esto cuentan como blanco
ESPACIO = 26       # diferencia máxima entre canales (casi neutro)


def es_blanco(r, g, b):
    return min(r, g, b) >= UMBRAL and (max(r, g, b) - min(r, g, b)) <= ESPACIO


def fondo_es_blanco(px, ancho, alto):
    puntos = [(x, y) for x in range(0, ancho, max(1, ancho // 40)) for y in (0, alto - 1)]
    puntos += [(x, y) for y in range(0, alto, max(1, alto // 40)) for x in (0, ancho - 1)]
    blancos = sum(1 for x, y in puntos if es_blanco(*px[x, y][:3]))
    return blancos / len(puntos) > 0.85


def quitar_fondo(img):
    img = img.convert('RGBA')
    ancho, alto = img.size
    px = img.load()
    visto = bytearray(ancho * alto)
    cola = deque()

    def intentar(x, y):
        i = y * ancho + x
        if not visto[i] and es_blanco(*px[x, y][:3]):
            visto[i] = 1
            cola.append((x, y))

    for x in range(ancho):
        intentar(x, 0)
        intentar(x, alto - 1)
    for y in range(alto):
        intentar(0, y)
        intentar(ancho - 1, y)

    while cola:
        x, y = cola.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < ancho and 0 <= ny < alto:
                intentar(nx, ny)
    return img


def main():
    db = sqlite3.connect(DB)
    filas = db.execute('SELECT id, producto_id, ruta FROM producto_fotos ORDER BY producto_id, id').fetchall()
    if not filas:
        print('No hay fotos registradas.')
        return
    cambiadas = saltadas = 0
    for fid, producto_id, ruta in filas:
        origen = UPLOADS / ruta
        if not origen.exists():
            print(f'  foto #{fid}: archivo perdido ({ruta})')
            continue
        try:
            img = Image.open(origen)
        except Exception as e:
            print(f'  foto #{fid}: no se pudo abrir ({e})')
            continue
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            print(f'  foto #{fid}: ya tiene transparencia, se deja')
            saltadas += 1
            continue
        px = img.convert('RGBA').load()
        if not fondo_es_blanco(px, img.width, img.height):
            print(f'  foto #{fid}: el fondo no es blanco, se deja')
            saltadas += 1
            continue
        salida = quitar_fondo(img)
        nueva_ruta = str(Path(ruta).with_suffix('.png')).replace('\\', '/')
        salida.save(UPLOADS / nueva_ruta, 'PNG')
        db.execute('UPDATE producto_fotos SET ruta = ? WHERE id = ?', (nueva_ruta, fid))
        origen.unlink()
        print(f'  foto #{fid}: fondo quitado -> {nueva_ruta}')
        cambiadas += 1
    db.commit()
    db.close()
    print(f'Listo: {cambiadas} convertidas, {saltadas} sin cambios.')


if __name__ == '__main__':
    sys.exit(main())
