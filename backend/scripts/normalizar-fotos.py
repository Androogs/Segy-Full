# Normaliza las fotos de producto al mismo lienzo cuadrado:
# recorta el borde transparente, escala el contenido a una caja fija
# y lo centra en un lienzo 1400x1400. Asi todas las tarjetas se ven del mismo tamano.
# Uso:  python scripts/normalizar-fotos.py
import sqlite3
import sys
from pathlib import Path

from PIL import Image

BACKEND = Path(__file__).resolve().parent.parent
DB = BACKEND / 'data' / 'segy.db'
UPLOADS = BACKEND / 'data' / 'archivos'

LIENZO = 1400          # tamano del lienzo cuadrado final
CAJA = 1290            # el contenido cabe en una caja de 1120x1120 (80% del lienzo)
ALFA_MIN = 12          # alfa por encima de esto cuenta como contenido


def normalizar(img):
    img = img.convert('RGBA')
    alfa = img.getchannel('A')
    bbox = alfa.point(lambda a: 255 if a > ALFA_MIN else 0).getbbox()
    if bbox:
        img = img.crop(bbox)
    escala = min(CAJA / img.width, CAJA / img.height)
    if abs(escala - 1) > 0.01:
        img = img.resize((round(img.width * escala), round(img.height * escala)), Image.LANCZOS)
    lienzo = Image.new('RGBA', (LIENZO, LIENZO), (0, 0, 0, 0))
    lienzo.paste(img, ((LIENZO - img.width) // 2, (LIENZO - img.height) // 2))
    return lienzo


def main():
    db = sqlite3.connect(DB)
    filas = db.execute('SELECT id, ruta FROM producto_fotos ORDER BY id').fetchall()
    if not filas:
        print('No hay fotos registradas.')
        return
    ok = fallos = 0
    for fid, ruta in filas:
        origen = UPLOADS / ruta
        if not origen.exists():
            print(f'  foto #{fid}: archivo perdido ({ruta})')
            continue
        try:
            salida = normalizar(Image.open(origen))
        except Exception as e:
            print(f'  foto #{fid}: error ({e})')
            fallos += 1
            continue
        nueva_ruta = str(Path(ruta).with_suffix('.png')).replace('\\', '/')
        if nueva_ruta != ruta:
            salida.save(UPLOADS / nueva_ruta, 'PNG')
            db.execute('UPDATE producto_fotos SET ruta = ? WHERE id = ?', (nueva_ruta, fid))
            origen.unlink()
        else:
            salida.save(origen, 'PNG')
        ok += 1
    db.commit()
    db.close()
    print(f'Listo: {ok} normalizadas, {fallos} con error.')


if __name__ == '__main__':
    sys.exit(main())
