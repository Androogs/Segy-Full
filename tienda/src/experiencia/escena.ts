// Escena 3D de la portada (three.js). Se carga bajo demanda (import dinámico) cuando la experiencia entra en pantalla.
// Iluminación de estudio con reflejos (RoomEnvironment) y una luz de contorno en rojo SEGY que dibuja el borde del equipo.
import {
  ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, Group, Mesh, PMREMGenerator, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type Object3D,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { crearDispositivo, ALTO, type Dispositivo } from './dispositivo';
import { calcomaniaPalmera, prepararExterno, type ExternoPrep } from './externo';
import type { ModoPantalla } from './pantalla';
import type { Pose } from './coreografia';

export interface OpcionesEscena { modelo?: { url: string | null; escala: number; rotacionInicial: [number, number, number] } }
export interface Escena {
  dibujar(pose: Pose, tiempo: number): void;
  acabado(marco: string, espalda: string): void;
  pantalla(modo: ModoPantalla, tinte?: string | null): void;
  redimensionar(): void;
  destruir(): void;
}

const FOV = 28;
const DISTANCIA = 5.6;

export function soportaWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export async function crearEscena(lienzo: HTMLCanvasElement, opciones: OpcionesEscena = {}): Promise<Escena> {
  const renderer = new WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const escena = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environment = entorno;
  pmrem.dispose();

  const camara = new PerspectiveCamera(FOV, 1, 0.1, 50);
  camara.position.set(0, 0, DISTANCIA);

  escena.add(new AmbientLight('#ffffff', 0.25));
  const principal = new DirectionalLight('#ffffff', 1.7); principal.position.set(3, 4, 5); escena.add(principal);
  const relleno = new DirectionalLight('#d6deff', 0.55); relleno.position.set(-4, 1, 3); escena.add(relleno);
  const contornoRojo = new DirectionalLight('#ff0808', 3.2); contornoRojo.position.set(-3.5, 1.5, -3); escena.add(contornoRojo);
  const contornoBlanco = new DirectionalLight('#ffffff', 0.9); contornoBlanco.position.set(3.5, -1, -3); escena.add(contornoBlanco);

  // Inclinación (x, z) por fuera y giro (y) por dentro: así el equipo gira sobre su eje como en un tocadiscos.
  const inclinacion = new Group();
  const giro = new Group();
  inclinacion.add(giro);
  escena.add(inclinacion);

  const generico: Dispositivo = crearDispositivo();
  giro.add(generico.grupo);
  let externo: Object3D | null = null;
  let prep: ExternoPrep | null = null;

  // Modelo oficial opcional (GLB con licencia). Si falla, se queda el genérico.
  const m = opciones.modelo;
  if (m && m.url) {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(m.url);
      const obj = gltf.scene;
      prep = prepararExterno(obj); // sin la manzana: se oculta y va la palmera de SEGY
      const caja = new Box3().setFromObject(obj);
      const tam = caja.getSize(new Vector3());
      const centro = caja.getCenter(new Vector3());
      obj.position.sub(centro);
      const envoltura = new Group();
      envoltura.add(obj);
      envoltura.scale.setScalar((ALTO / Math.max(tam.y, 1e-6)) * (m.escala || 1));
      envoltura.rotation.set(...m.rotacionInicial);
      envoltura.updateWorldMatrix(true, true);
      const palmera = await calcomaniaPalmera(new Box3().setFromObject(envoltura));
      giro.remove(generico.grupo);
      giro.add(envoltura);
      if (palmera) giro.add(palmera);
      externo = envoltura;
    } catch (e) {
      console.warn('[SEGY] No se pudo cargar el modelo 3D; se usa el equipo genérico.', e);
    }
  }

  let medioAncho = 2.4;
  function redimensionar() {
    const w = lienzo.clientWidth || 1; const h = lienzo.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 700 ? 2 : 1.75));
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    const altoVisible = 2 * DISTANCIA * Math.tan((FOV * Math.PI) / 360);
    medioAncho = (altoVisible * camara.aspect) / 2;
  }
  redimensionar();

  return {
    dibujar(pose, t) {
      // La posición horizontal se adapta al ancho de la ventana para que el equipo nunca se salga ni tape el texto.
      const factorX = Math.min(1.2, medioAncho * 0.46);
      inclinacion.position.set(pose.x * factorX, pose.y + Math.sin(t * 0.8) * 0.014, 0);
      inclinacion.rotation.set(pose.rx, 0, pose.rz + Math.sin(t * 0.55) * 0.008);
      giro.rotation.y = pose.ry;
      inclinacion.scale.setScalar(pose.s);
      renderer.render(escena, camara);
    },
    acabado(marco, espalda) { generico.fijarAcabado(marco, espalda); prep?.fijarAcabado(marco, espalda); },
    pantalla(modo, tinte = null) {
      if (prep?.pantalla) prep.pantalla.dibujar(modo, tinte);
      else if (!externo) generico.fijarPantalla(modo, tinte);
    },
    redimensionar,
    destruir() {
      prep?.liberar();
      if (externo) giro.traverse((o) => { const mm = o as Mesh; if (mm.isMesh) { mm.geometry.dispose(); (Array.isArray(mm.material) ? mm.material : [mm.material]).forEach((x) => x.dispose()); } });
      generico.liberar();
      entorno.dispose();
      renderer.dispose();
    },
  };
}
