// Preparación del modelo 3D descargado (con licencia): oculta la marca del fabricante, conecta la pantalla viva de la
// experiencia a la malla de pantalla del archivo y agrupa los materiales del cuerpo para que el capítulo de acabados
// también le cambie el color. La palmera de SEGY se pega aparte como calcomanía (ver calcomaniaPalmera).
// La detección es por nombre de malla o de material; si el archivo usa otros nombres se ajustan las expresiones aquí
// (al cargar, la consola lista las mallas y materiales encontrados para esa afinación).
import { Box3, CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Color, type Material, type Object3D } from 'three';
import { Pantalla, cargarLogo } from './pantalla';

const RE_MARCA = /apple|logo|manzana/i;
const RE_PANTALLA = /screen|display|pantalla|lcd|wallpaper/i;
const RE_MARCO = /frame|borde|chassis|aluminum|titanio|metal|band/i;
const RE_CUERPO = /body|back|housing|carcasa|cover|panel|rear|case/i;
const RE_NO_TOCAR = /lens|lente|camera|flash|speaker|button|boton|cristal|glass/i;

export interface ExternoPrep {
  pantalla: Pantalla | null;          // pantalla viva conectada a la malla del modelo (null si no se encontró)
  fijarAcabado(marco: string, espalda: string): void;
  liberar(): void;
}

export function prepararExterno(obj: Object3D): ExternoPrep {
  let pantalla: Pantalla | null = null;
  const marco = new Set<Material>();
  const cuerpo = new Set<Material>();
  const inventario: string[] = [];

  obj.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    inventario.push(`${mesh.name || '(malla sin nombre)'} → ${mats.map((m) => m?.name || '—').join(', ')}`);

    // La marca del fabricante queda fuera: en su lugar va la palmera de SEGY.
    if (RE_MARCA.test(mesh.name) || mats.some((m) => m && RE_MARCA.test(m.name))) {
      mesh.visible = false;
      console.info('[SEGY] Modelo externo: se ocultó la marca en', mesh.name || '(malla sin nombre)');
      return;
    }

    // La malla de la pantalla muestra la pantalla viva de la experiencia (bloqueo, cámara, rendimiento, vivo).
    if (!pantalla && (RE_PANTALLA.test(mesh.name) || mats.some((m) => m && RE_PANTALLA.test(m.name)))) {
      pantalla = new Pantalla();
      mesh.material = new MeshBasicMaterial({ map: pantalla.textura, toneMapped: false });
      return;
    }

    for (const m of mats) {
      if (!m || !('color' in m)) continue;
      const n = `${mesh.name} ${m.name}`;
      if (RE_NO_TOCAR.test(n)) continue;
      if (RE_MARCO.test(n)) marco.add(m);
      else if (RE_CUERPO.test(n)) cuerpo.add(m);
    }
  });
  console.info('[SEGY] Modelo externo — mallas detectadas:\n' + inventario.join('\n'));

  return {
    pantalla,
    fijarAcabado(colorMarco, colorEspalda) {
      marco.forEach((m) => (m as Material & { color: Color }).color.set(colorMarco));
      cuerpo.forEach((m) => (m as Material & { color: Color }).color.set(colorEspalda));
    },
    liberar() { pantalla?.textura.dispose(); },
  };
}

// Calcomanía con la palmera de SEGY para la espalda del modelo externo. La caja ya viene en unidades de escena y con
// la orientación final; la espalda es la cara −Z. Se agrega como hermana del modelo dentro del grupo de giro.
export async function calcomaniaPalmera(caja: Box3): Promise<Mesh | null> {
  const logo = await cargarLogo();
  if (!logo) return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(logo, 0, 0, 512, 512);
  // Silueta blanca (como un grabado): el fondo transparente deja ver el material del equipo.
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  const lado = (caja.max.x - caja.min.x) * 0.5;
  const malla = new Mesh(new PlaneGeometry(lado, lado), new MeshBasicMaterial({ map: t, transparent: true, opacity: 0.85, depthWrite: false }));
  malla.rotation.y = Math.PI;
  malla.position.set(0, (caja.min.y + caja.max.y) / 2 - (caja.max.y - caja.min.y) * 0.08, caja.min.z - 0.004);
  return malla;
}
