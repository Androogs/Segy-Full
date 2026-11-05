// Equipo genérico de SEGY modelado con geometría propia: cuerpo de aluminio con bordes suavizados, frente de vidrio con
// pantalla viva, meseta de cámaras que cruza todo el ancho superior (triángulo de lentes a un lado, flash y LiDAR al
// otro), panel de vidrio de dos tonos con la palmera de SEGY grabada, botones laterales y puerto de carga.
// Es un modelo de presentación de la marca; para mostrar el modelo oficial de un producto se carga un GLB con licencia
// (ver src/contenido/insignia.ts → modelo3d y public/media/LEEME.md).
import {
  AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Shape, ShapeGeometry, type BufferGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Pantalla, cargarLogo, type ModoPantalla } from './pantalla';

// Medidas en unidades de escena (1 unidad ≈ 10 cm).
export const ANCHO = 0.78;
export const ALTO = 1.63;
const GROSOR = 0.084;
const RADIO = 0.11;
const BISEL = 0.014;

function rectRedondeado(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2; const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.bezierCurveTo(x + w - r * 0.35, y, x + w, y + r * 0.35, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.bezierCurveTo(x + w, y + h - r * 0.35, x + w - r * 0.35, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.bezierCurveTo(x + r * 0.35, y + h, x, y + h - r * 0.35, x, y + h - r);
  s.lineTo(x, y + r);
  s.bezierCurveTo(x, y + r * 0.35, x + r * 0.35, y, x + r, y);
  return s;
}

// ShapeGeometry deja las UV en coordenadas de la forma: se normalizan a 0..1 para que la textura cubra la pantalla.
function normalizarUV(geo: BufferGeometry): BufferGeometry {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const pos = geo.attributes.position; const uv = geo.attributes.uv;
  const w = b.max.x - b.min.x; const h = b.max.y - b.min.y;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - b.min.x) / w, (pos.getY(i) - b.min.y) / h);
  uv.needsUpdate = true;
  return geo;
}

async function texturaLogo(): Promise<CanvasTexture | null> {
  const logo = await cargarLogo();
  if (!logo) return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(logo, 0, 0, 512, 512);
  // Silueta blanca: el color final lo pone el material (grabado en el tono del acabado).
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface Dispositivo {
  grupo: Group;
  fijarAcabado(marco: string, espalda: string): void;
  fijarPantalla(modo: ModoPantalla, tinte?: string | null): void;
  liberar(): void;
}

export function crearDispositivo(): Dispositivo {
  const grupo = new Group();
  const geometrias: BufferGeometry[] = [];
  const reg = <T extends BufferGeometry>(g: T): T => { geometrias.push(g); return g; };

  const marco = new MeshPhysicalMaterial({ color: '#b9bcc2', metalness: 0.88, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 1.15 });
  const espalda = new MeshPhysicalMaterial({ color: '#d9dadd', metalness: 0.55, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5, envMapIntensity: 0.42 });
  const meseta = new MeshPhysicalMaterial({ color: '#d9dadd', metalness: 0.6, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.6 });
  const panel = new MeshPhysicalMaterial({ color: '#e6e7ea', metalness: 0.35, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.5 });
  const vidrioFrente = new MeshPhysicalMaterial({ color: '#030303', metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3 });
  const anillo = new MeshStandardMaterial({ color: '#141416', metalness: 0.92, roughness: 0.22 });
  const lente = new MeshPhysicalMaterial({ color: '#020309', metalness: 0.4, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.25, iridescenceIOR: 1.4, envMapIntensity: 0.9 });
  const flash = new MeshStandardMaterial({ color: '#f1e6c8', emissive: '#4a3d20', roughness: 0.4 });
  const puerto = new MeshStandardMaterial({ color: '#050505', roughness: 0.6 });
  const pantalla = new Pantalla();
  const materialPantalla = new MeshBasicMaterial({ map: pantalla.textura, toneMapped: false });
  // Reflejo del vidrio sobre la pantalla: material negro aditivo que solo suma los reflejos del entorno.
  const reflejo = new MeshStandardMaterial({ color: '#000000', metalness: 1, roughness: 0.1, transparent: true, blending: AdditiveBlending, depthWrite: false, envMapIntensity: 0.32 });
  const grabado = new MeshPhysicalMaterial({ color: '#a8aaad', metalness: 0.7, roughness: 0.25, transparent: true, side: DoubleSide });

  // Cuerpo: contorno redondeado extruido con bisel. Grupo 0 = caras (atrás/adelante), grupo 1 = canto (marco).
  const cuerpoGeo = reg(new ExtrudeGeometry(rectRedondeado(ANCHO - 2 * BISEL, ALTO - 2 * BISEL, RADIO - BISEL), {
    depth: GROSOR - 2 * BISEL, bevelEnabled: true, bevelThickness: BISEL, bevelSize: BISEL, bevelSegments: 10, curveSegments: 36,
  }));
  cuerpoGeo.translate(0, 0, -(GROSOR - 2 * BISEL) / 2);
  grupo.add(new Mesh(cuerpoGeo, [espalda, marco]));

  const z0 = GROSOR / 2;
  const frente = new Mesh(reg(new ShapeGeometry(rectRedondeado(ANCHO - 0.01, ALTO - 0.01, RADIO - 0.005), 36)), vidrioFrente);
  frente.position.z = z0 + 0.0006;
  grupo.add(frente);
  const geoPantalla = reg(normalizarUV(new ShapeGeometry(rectRedondeado(ANCHO - 0.052, ALTO - 0.052, RADIO - 0.026), 36)));
  const malla = new Mesh(geoPantalla, materialPantalla);
  malla.position.z = z0 + 0.0012;
  grupo.add(malla);
  const capaReflejo = new Mesh(geoPantalla, reflejo);
  capaReflejo.position.z = z0 + 0.0018;
  grupo.add(capaReflejo);

  // Espalda de dos tonos: panel de vidrio más claro bajo la meseta, con la palmera grabada en el centro.
  const panelGeo = reg(new ExtrudeGeometry(rectRedondeado(0.68, 1.2, 0.08), { depth: 0.003, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 3, curveSegments: 32 }));
  const panelMalla = new Mesh(panelGeo, panel);
  panelMalla.rotation.y = Math.PI;
  panelMalla.position.set(0, -0.15, -z0 + 0.004);
  grupo.add(panelMalla);

  // Espalda: palmera grabada.
  const placaLogo = new Mesh(reg(new PlaneGeometry(0.4, 0.4)), grabado);
  placaLogo.rotation.y = Math.PI;
  placaLogo.position.set(0, -0.13, -z0 - 0.0022);
  grupo.add(placaLogo);
  void texturaLogo().then((t) => { if (t) { grabado.map = t; grabado.alphaMap = null; grabado.needsUpdate = true; } else placaLogo.visible = false; });
  grabado.opacity = 0; // invisible hasta que cargue la textura
  void cargarLogo().then((l) => { grabado.opacity = l ? 0.9 : 0; });

  // Meseta de cámaras: barra horizontal que cruza todo el ancho superior. Mirando el equipo de espaldas, el triángulo
  // de lentes queda a la izquierda (+x en coordenadas del equipo) y el flash, el micrófono y el LiDAR a la derecha.
  const cyMes = ALTO / 2 - 0.03 - 0.15;
  const mesetaGeo = reg(new ExtrudeGeometry(rectRedondeado(0.72, 0.3, 0.095), { depth: 0.014, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 8, curveSegments: 32 }));
  const mesetaMalla = new Mesh(mesetaGeo, meseta);
  mesetaMalla.rotation.y = Math.PI;
  mesetaMalla.position.set(0, cyMes, -z0 + 0.004);
  grupo.add(mesetaMalla);
  const geoAnillo = reg(new CylinderGeometry(0.06, 0.062, 0.024, 48));
  const geoLente = reg(new CylinderGeometry(0.045, 0.045, 0.006, 48));
  for (const [dx, dy] of [[0.235, 0.075], [0.235, -0.075], [0.125, 0]] as [number, number][]) {
    const a = new Mesh(geoAnillo, anillo); a.rotation.x = Math.PI / 2; a.position.set(dx, cyMes + dy, -z0 - 0.024); grupo.add(a);
    const l = new Mesh(geoLente, lente); l.rotation.x = Math.PI / 2; l.position.set(dx, cyMes + dy, -z0 - 0.038); grupo.add(l);
  }
  const f = new Mesh(reg(new CylinderGeometry(0.022, 0.022, 0.008, 32)), flash);
  f.rotation.x = Math.PI / 2; f.position.set(-0.305, cyMes + 0.085, -z0 - 0.019); grupo.add(f);
  const micro = new Mesh(reg(new CylinderGeometry(0.008, 0.008, 0.006, 24)), puerto);
  micro.rotation.x = Math.PI / 2; micro.position.set(-0.305, cyMes + 0.02, -z0 - 0.019); grupo.add(micro);
  const lidar = new Mesh(reg(new CylinderGeometry(0.033, 0.034, 0.008, 40)), lente);
  lidar.rotation.x = Math.PI / 2; lidar.position.set(-0.305, cyMes - 0.08, -z0 - 0.019); grupo.add(lidar);

  // Botones laterales y puerto de carga.
  const boton = (w: number, h: number, x: number, y: number) => { const m = new Mesh(reg(new RoundedBoxGeometry(w, h, 0.03, 3, 0.006)), marco); m.position.set(x, y, 0); grupo.add(m); };
  boton(0.016, 0.17, ANCHO / 2 + 0.002, 0.28);
  boton(0.016, 0.11, -ANCHO / 2 - 0.002, 0.43);
  boton(0.016, 0.11, -ANCHO / 2 - 0.002, 0.29);
  boton(0.016, 0.06, -ANCHO / 2 - 0.002, 0.58);
  const p = new Mesh(reg(new RoundedBoxGeometry(0.1, 0.02, 0.032, 3, 0.009)), puerto); p.position.set(0, -ALTO / 2 + 0.004, 0); grupo.add(p);

  const tono = new Color();
  return {
    grupo,
    fijarAcabado(colorMarco, colorEspalda) {
      marco.color.set(colorMarco);
      espalda.color.set(colorEspalda);
      meseta.color.set(colorEspalda);
      tono.set(colorEspalda);
      const hsl = { h: 0, s: 0, l: 0 }; tono.getHSL(hsl);
      // Panel de vidrio: un tono más claro y menos saturado que la espalda.
      panel.color.setHSL(hsl.h, hsl.s * 0.65, Math.min(0.92, hsl.l + 0.11));
      // Grabado: un tono más claro (acabados oscuros) o más oscuro (acabados claros) que la espalda.
      grabado.color.setHSL(hsl.h, hsl.s * 0.8, hsl.l > 0.6 ? hsl.l - 0.14 : hsl.l + 0.12);
    },
    fijarPantalla(modo, tinte = null) { pantalla.dibujar(modo, tinte); },
    liberar() {
      geometrias.forEach((g) => g.dispose());
      [marco, espalda, meseta, panel, vidrioFrente, anillo, lente, flash, puerto, materialPantalla, reflejo, grabado].forEach((m) => m.dispose());
      pantalla.textura.dispose();
      grabado.map?.dispose();
    },
  };
}
