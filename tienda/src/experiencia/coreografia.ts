// Coreografía de la experiencia: cómo se mueve el equipo mientras se desplaza la página.
// El avance p va de 0 (inicio de la sección) a 1 (final). Cada capítulo ocupa una ventana [desde, hasta] y el equipo
// interpola entre poses clave con una curva suave. Para ajustar el movimiento basta con editar las tablas de este archivo.

export interface Pose {
  x: number; y: number;      // posición en unidades de escena (el equipo mide 1,63 de alto)
  rx: number; ry: number; rz: number; // giros en radianes (ry = giro sobre su eje vertical)
  s: number;                 // escala
}
export interface Clave { p: number; pose: Pose }

const PI = Math.PI;

// Ventanas de cada capítulo (mismo orden que INSIGNIA.capitulos).
export const VENTANAS: [number, number][] = [
  [0.0, 0.12],
  [0.17, 0.3],
  [0.35, 0.47],
  [0.52, 0.64],
  [0.69, 0.81],
  [0.86, 1.0],
];

const P = (x: number, y: number, rx: number, ry: number, rz: number, s: number): Pose => ({ x, y, rx, ry, rz, s });

// Escritorio: el texto alterna de lado y el equipo ocupa el lado contrario.
export const CLAVES_ESCRITORIO: Clave[] = [
  { p: 0.0, pose: P(0, -0.04, 0.1, -0.5, 0.04, 1.02) },
  { p: 0.12, pose: P(0, 0.02, 0.06, -0.18, 0.0, 1.02) },
  { p: 0.17, pose: P(0.92, 0.0, 0.08, PI - 0.42, -0.1, 1.14) },      // de espaldas: cámaras
  { p: 0.3, pose: P(0.92, 0.04, 0.02, PI + 0.22, -0.04, 1.18) },
  { p: 0.35, pose: P(-0.9, -0.02, -0.04, PI + 1.02, 0.16, 1.12) },   // tres cuartos: perfil y cuerpo
  { p: 0.47, pose: P(-0.9, 0.02, 0.04, PI + 1.32, 0.08, 1.14) },
  { p: 0.52, pose: P(0.66, -0.02, 0.0, 2 * PI - 0.12, 0.0, 1.24) },  // de frente y grande: pantalla
  { p: 0.64, pose: P(0.66, 0.02, 0.02, 2 * PI + 0.1, 0.0, 1.28) },
  { p: 0.69, pose: P(0.95, 0.0, 0.1, 2 * PI + 0.9, -0.06, 1.08) },   // vuelta completa mientras cambian los acabados
  { p: 0.81, pose: P(0.95, 0.0, 0.1, 2 * PI + 2 * PI - 0.5, -0.06, 1.08) },
  { p: 0.86, pose: P(-0.85, -0.04, 0.08, 4 * PI - 0.42, 0.06, 0.98) },  // compra: el equipo a la izquierda
  { p: 1.0, pose: P(-0.85, 0.0, 0.06, 4 * PI - 0.26, 0.03, 0.98) },
];

// Celular: el equipo arriba y centrado; el texto abajo.
export const CLAVES_MOVIL: Clave[] = [
  { p: 0.0, pose: P(0, -0.12, 0.1, -0.5, 0.04, 0.78) },
  { p: 0.12, pose: P(0, -0.04, 0.06, -0.18, 0.0, 0.82) },
  { p: 0.17, pose: P(0, 0.42, 0.08, PI - 0.42, -0.08, 0.86) },
  { p: 0.3, pose: P(0, 0.46, 0.02, PI + 0.22, -0.04, 0.88) },
  { p: 0.35, pose: P(0, 0.42, -0.04, PI + 1.02, 0.14, 0.86) },
  { p: 0.47, pose: P(0, 0.46, 0.04, PI + 1.32, 0.08, 0.88) },
  { p: 0.52, pose: P(0, 0.42, 0.0, 2 * PI - 0.12, 0.0, 0.94) },
  { p: 0.64, pose: P(0, 0.46, 0.02, 2 * PI + 0.1, 0.0, 0.96) },
  { p: 0.69, pose: P(0, 0.42, 0.1, 2 * PI + 0.9, -0.06, 0.84) },
  { p: 0.81, pose: P(0, 0.46, 0.1, 4 * PI - 0.5, -0.06, 0.84) },
  { p: 0.86, pose: P(0, 0.5, 0.08, 4 * PI - 0.42, 0.06, 0.72) },
  { p: 1.0, pose: P(0, 0.52, 0.06, 4 * PI - 0.26, 0.03, 0.72) },
];

const suave = (t: number) => t * t * (3 - 2 * t);
const mezcla = (a: number, b: number, t: number) => a + (b - a) * t;

export function poseEn(p: number, claves: Clave[]): Pose {
  if (p <= claves[0].p) return claves[0].pose;
  const ultima = claves[claves.length - 1];
  if (p >= ultima.p) return ultima.pose;
  let i = 0;
  while (i < claves.length - 2 && p > claves[i + 1].p) i++;
  const a = claves[i]; const b = claves[i + 1];
  const t = suave((p - a.p) / (b.p - a.p));
  return { x: mezcla(a.pose.x, b.pose.x, t), y: mezcla(a.pose.y, b.pose.y, t), rx: mezcla(a.pose.rx, b.pose.rx, t), ry: mezcla(a.pose.ry, b.pose.ry, t), rz: mezcla(a.pose.rz, b.pose.rz, t), s: mezcla(a.pose.s, b.pose.s, t) };
}

// Visibilidad de un capítulo: entra en 0,04 antes de su ventana, se mantiene y sale en 0,04 después.
const BORDE = 0.04;
export function presencia(p: number, i: number): number {
  const [d, h] = VENTANAS[i];
  const entrada = i === 0 ? 1 : Math.min(1, Math.max(0, (p - (d - BORDE)) / BORDE));
  const salida = i === VENTANAS.length - 1 ? 1 : Math.min(1, Math.max(0, ((h + BORDE) - p) / BORDE));
  return Math.min(entrada, salida);
}
export function capituloEn(p: number): number {
  let mejor = 0; let peso = -1;
  VENTANAS.forEach((_, i) => { const v = presencia(p, i); if (v > peso) { peso = v; mejor = i; } });
  return mejor;
}
// Avance dentro de un capítulo (0..1), útil para el cambio de acabados.
export function avanceEn(p: number, i: number): number {
  const [d, h] = VENTANAS[i];
  return Math.min(1, Math.max(0, (p - d) / (h - d)));
}
// Punto de desplazamiento (0..1) que centra un capítulo: lo usa el riel para saltar.
export const centroDe = (i: number): number => (i === 0 ? 0 : (VENTANAS[i][0] + VENTANAS[i][1]) / 2);
