// Pantalla del equipo: se dibuja en un canvas y se usa como textura. Cada capítulo muestra un contenido distinto
// (bloqueo con la palmera de SEGY, visor de cámara, rendimiento, fondo vivo). Todo es dibujo propio: sin capturas de
// pantalla de ningún sistema operativo.
import { CanvasTexture, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter } from 'three';

export type ModoPantalla = 'bloqueo' | 'camara' | 'rendimiento' | 'vivo';
const ANCHO = 720;
const ALTO = 1560;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let logoPromesa: Promise<HTMLImageElement | null> | null = null;
export function cargarLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromesa) {
    logoPromesa = new Promise((ok) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = '/marca/logo-segy.webp';
    });
  }
  return logoPromesa;
}

// Recorte de la copa de la palmera dentro del logo (imagen de 2000 × 2000).
const PALMA = { sx: 350, sy: 262, sw: 1480, sh: 528 };

function palmera(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, y: number, ancho: number, alfa: number) {
  if (!logo) return;
  const esc = ancho / PALMA.sw;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.drawImage(logo, PALMA.sx, PALMA.sy, PALMA.sw, PALMA.sh, x - ancho / 2, y, ancho, PALMA.sh * esc);
  ctx.restore();
}

function barraEstado(ctx: CanvasRenderingContext2D, claro = true) {
  const c = claro ? '#ffffff' : '#0a0a0a';
  // Isla dinámica: píldora negra centrada con la cámara frontal dentro, a la derecha.
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.roundRect(ANCHO / 2 - 108, 35, 216, 35, 18); ctx.fill();
  ctx.fillStyle = '#101318';
  ctx.beginPath(); ctx.arc(ANCHO / 2 + 62, 52, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c;
  ctx.font = '600 30px "Inter Variable", Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('SEGY', 54, 54);
  // batería
  ctx.strokeStyle = c; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(ANCHO - 112, 41, 50, 26, 7); ctx.stroke();
  ctx.fillRect(ANCHO - 60, 49, 4, 10);
  ctx.beginPath(); ctx.roundRect(ANCHO - 107, 46, 34, 16, 4); ctx.fill();
  // señal
  for (let i = 0; i < 4; i++) ctx.fillRect(ANCHO - 182 + i * 12, 64 - (i + 1) * 6, 7, (i + 1) * 6);
}

function reloj(ctx: CanvasRenderingContext2D, y: number) {
  const d = new Date();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '500 36px "Inter Variable", Inter, system-ui, sans-serif';
  ctx.fillText(`${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`, ANCHO / 2, y);
  ctx.font = '800 200px "Archivo Variable", "Inter Variable", system-ui, sans-serif';
  const hh = String(d.getHours() % 12 || 12); const mm = String(d.getMinutes()).padStart(2, '0');
  ctx.fillText(`${hh}:${mm}`, ANCHO / 2, y + 205);
  ctx.textAlign = 'left';
}

function indicadorInicio(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.roundRect(ANCHO / 2 - 120, ALTO - 34, 240, 9, 5); ctx.fill();
}

function bloqueo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, tinte: string | null) {
  const g = ctx.createLinearGradient(0, 0, 0, ALTO);
  g.addColorStop(0, '#120202'); g.addColorStop(0.55, '#0a0a0a'); g.addColorStop(1, '#1d0000');
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO);
  const r = ctx.createRadialGradient(ANCHO / 2, ALTO * 1.02, 20, ANCHO / 2, ALTO * 1.02, ALTO * 0.42);
  r.addColorStop(0, 'rgba(255,40,20,0.55)'); r.addColorStop(0.5, 'rgba(120,0,0,0.22)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, ANCHO, ALTO);
  // La palmera de SEGY en rojo sobre fondo oscuro, con un halo suave para que se lea.
  ctx.save(); ctx.shadowColor = 'rgba(255,8,8,0.55)'; ctx.shadowBlur = 60;
  palmera(ctx, logo, ANCHO / 2 + 10, ALTO * 0.5, ANCHO * 1.3, 1);
  ctx.restore();
  if (tinte) {
    ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.fillStyle = tinte; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, ANCHO, ALTO); ctx.restore();
  }
  const sombra = ctx.createLinearGradient(0, 0, 0, ALTO * 0.5);
  sombra.addColorStop(0, 'rgba(0,0,0,0.55)'); sombra.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sombra; ctx.fillRect(0, 0, ANCHO, ALTO * 0.5);
  barraEstado(ctx);
  reloj(ctx, 250);
  indicadorInicio(ctx);
}

function camara(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  // Escena del visor: atardecer con la palmera en contraluz.
  const cielo = ctx.createLinearGradient(0, 0, 0, ALTO);
  cielo.addColorStop(0, '#1b2440'); cielo.addColorStop(0.45, '#b4463a'); cielo.addColorStop(0.62, '#f19a52'); cielo.addColorStop(1, '#25130c');
  ctx.fillStyle = cielo; ctx.fillRect(0, 0, ANCHO, ALTO);
  const sol = ctx.createRadialGradient(ANCHO * 0.62, ALTO * 0.6, 10, ANCHO * 0.62, ALTO * 0.6, 260);
  sol.addColorStop(0, 'rgba(255,240,200,0.95)'); sol.addColorStop(0.2, 'rgba(255,190,110,0.6)'); sol.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = sol; ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.save(); ctx.filter = 'brightness(0)'; palmera(ctx, logo, ANCHO * 0.42, ALTO * 0.3, ANCHO * 1.5, 0.92); ctx.restore();
  ctx.fillStyle = 'rgba(10,6,4,0.95)'; ctx.fillRect(0, ALTO * 0.78, ANCHO, ALTO * 0.22);
  // Guías de tercios
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
  for (const f of [1 / 3, 2 / 3]) {
    ctx.beginPath(); ctx.moveTo(ANCHO * f, 140); ctx.lineTo(ANCHO * f, ALTO * 0.78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 140 + (ALTO * 0.78 - 140) * f); ctx.lineTo(ANCHO, 140 + (ALTO * 0.78 - 140) * f); ctx.stroke();
  }
  // Recuadro de enfoque
  ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 4;
  ctx.strokeRect(ANCHO * 0.42, ALTO * 0.38, 150, 150);
  // Selector de zoom
  const zooms = ['0,5', '1', '2', '4', '8'];
  zooms.forEach((z, i) => {
    const cx = ANCHO / 2 + (i - 2) * 96; const cy = ALTO * 0.75;
    ctx.fillStyle = i === 4 ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = i === 4 ? '#0a0a0a' : '#fff';
    ctx.font = '700 26px "Inter Variable", Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(i === 4 ? '8x' : z, cx, cy + 1);
  });
  // Modos y obturador
  ctx.font = '600 28px "Inter Variable", Inter, system-ui, sans-serif';
  ['Video', 'Foto', 'Retrato'].forEach((m, i) => { ctx.fillStyle = i === 1 ? '#ffd60a' : 'rgba(255,255,255,0.75)'; ctx.fillText(m, ANCHO / 2 + (i - 1) * 150, ALTO * 0.83); });
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ANCHO / 2, ALTO * 0.915, 66, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(ANCHO / 2, ALTO * 0.915, 56, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'left';
  barraEstado(ctx);
}

function rendimiento(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, ANCHO, ALTO);
  const r = ctx.createRadialGradient(ANCHO / 2, ALTO * 0.38, 20, ANCHO / 2, ALTO * 0.38, 520);
  r.addColorStop(0, 'rgba(255,8,8,0.55)'); r.addColorStop(1, 'rgba(255,8,8,0)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, ANCHO, ALTO);
  // Anillos concéntricos (núcleos trabajando)
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(255,${60 + i * 30},${60 + i * 30},${0.9 - i * 0.12})`; ctx.lineWidth = 14;
    const ini = -Math.PI / 2; const fin = ini + Math.PI * 2 * (0.95 - i * 0.11);
    ctx.beginPath(); ctx.arc(ANCHO / 2, ALTO * 0.38, 250 - i * 34, ini, fin); ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = '800 92px "Archivo Variable", system-ui, sans-serif'; ctx.fillText('120', ANCHO / 2, ALTO * 0.38 + 10);
  ctx.font = '600 32px "Inter Variable", Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText('cuadros por segundo', ANCHO / 2, ALTO * 0.38 + 60);
  // Barras de rendimiento sostenido
  const base = ALTO * 0.86; const n = 14;
  for (let i = 0; i < n; i++) {
    const h = 150 + Math.sin(i * 0.9) * 22 + i * 5;
    ctx.fillStyle = i > n - 4 ? '#ff0808' : 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.roundRect(70 + i * 42, base - h, 28, h, 8); ctx.fill();
  }
  ctx.font = '600 30px "Inter Variable", Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('Rendimiento sostenido', ANCHO / 2, base + 60);
  ctx.textAlign = 'left';
  palmera(ctx, logo, ANCHO / 2, 140, 160, 0.9);
  barraEstado(ctx);
  indicadorInicio(ctx);
}

function vivo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0a0410'; ctx.fillRect(0, 0, ANCHO, ALTO);
  const manchas: [number, number, number, string][] = [
    [0.2, 0.2, 620, 'rgba(255,8,8,0.95)'], [0.85, 0.35, 560, 'rgba(255,128,32,0.9)'],
    [0.3, 0.7, 640, 'rgba(120,40,255,0.85)'], [0.8, 0.9, 520, 'rgba(255,40,120,0.85)'], [0.5, 0.48, 300, 'rgba(255,220,120,0.6)'],
  ];
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, rad, c] of manchas) {
    const g = ctx.createRadialGradient(ANCHO * x, ALTO * y, 0, ANCHO * x, ALTO * y, rad);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO);
  }
  ctx.globalCompositeOperation = 'source-over';
  barraEstado(ctx);
  reloj(ctx, 250);
  indicadorInicio(ctx);
}

export class Pantalla {
  readonly canvas: HTMLCanvasElement;
  readonly textura: CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private logo: HTMLImageElement | null = null;
  private clave = '';
  private ultimo: [ModoPantalla, string | null] = ['bloqueo', null];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ANCHO; this.canvas.height = ALTO;
    this.ctx = this.canvas.getContext('2d')!;
    this.textura = new CanvasTexture(this.canvas);
    this.textura.colorSpace = SRGBColorSpace;
    this.textura.anisotropy = 4;
    this.textura.minFilter = LinearMipmapLinearFilter;
    this.textura.magFilter = LinearFilter;
    void cargarLogo().then((l) => { this.logo = l; this.clave = ''; this.dibujar(...this.ultimo); });
  }

  // Redibuja solo si cambió el modo, el tinte o el minuto (el reloj de la pantalla es real).
  dibujar(modo: ModoPantalla, tinte: string | null = null): void {
    this.ultimo = [modo, tinte];
    const minuto = Math.floor(Date.now() / 60000);
    const clave = `${modo}|${tinte}|${minuto}|${this.logo ? 1 : 0}`;
    if (clave === this.clave) return;
    this.clave = clave;
    const c = this.ctx;
    c.clearRect(0, 0, ANCHO, ALTO);
    if (modo === 'camara') camara(c, this.logo);
    else if (modo === 'rendimiento') rendimiento(c, this.logo);
    else if (modo === 'vivo') vivo(c);
    else bloqueo(c, this.logo, tinte);
    this.textura.needsUpdate = true;
  }
}
