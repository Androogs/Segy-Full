// Seguimiento web anónimo hacia Marketing del panel (mismo formato y mismas claves que backend/assets/segy-seguimiento.js):
// visitante anónimo y parámetros UTM guardados 30 días en este navegador. Sin cookies. Si el negocio no activó el
// seguimiento (Marketing › Integraciones), no se envía nada. Los pedidos y solicitudes llevan el mismo origen para que
// Marketing atribuya cada venta a su campaña.

const DIAS = 30;
const MS = DIAS * 24 * 60 * 60 * 1000;
const CLAVES_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
type Utm = Partial<Record<(typeof CLAVES_UTM)[number], string>>;

function leer<T>(clave: string): T | null {
  try {
    const raw = localStorage.getItem(clave);
    if (!raw) return null;
    const o = JSON.parse(raw) as { valor: T; hasta: number };
    if (o && o.hasta && o.hasta < Date.now()) { localStorage.removeItem(clave); return null; }
    return o ? o.valor : null;
  } catch { return null; }
}
function guardar(clave: string, valor: unknown): void {
  try { localStorage.setItem(clave, JSON.stringify({ valor, hasta: Date.now() + MS })); } catch { /* sin almacenamiento */ }
}
function idAleatorio(): string {
  const a = new Uint8Array(10);
  crypto.getRandomValues(a);
  return 'v' + Date.now().toString(36) + Array.from(a, (b) => (b % 36).toString(36)).join('');
}

let visitante = '';
let utm: Utm = {};
let destino: { token: string; endpoint: string } | null = null;
const BASE = (import.meta.env.VITE_SEGY_API || '').replace(/\/+$/, '');

export function prepararOrigen(): void {
  visitante = leer<string>('segy.visitante') || idAleatorio();
  guardar('segy.visitante', visitante);
  utm = leer<Utm>('segy.utm') || {};
  const p = new URLSearchParams(location.search);
  const nuevos: Utm = {};
  for (const k of CLAVES_UTM) { const v = p.get(k); if (v) nuevos[k] = v.slice(0, 120); }
  if (Object.keys(nuevos).length) { utm = nuevos; guardar('segy.utm', utm); }
}

export function activarSeguimiento(config: { token: string; endpoint: string } | null): void { destino = config; }

// Origen que acompaña a pedidos y solicitudes (atribución de campañas).
export const origen = () => ({ visitante, utm_source: utm.utm_source, utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign });

const recientes = new Map<string, number>();
function enviar(tipo: 'visita' | 'producto' | 'clic_contacto' | 'formulario', extra: Record<string, unknown> = {}): void {
  if (!destino) return;
  const clave = `${tipo}:${location.pathname}:${String(extra.producto_texto || '')}`;
  if ((recientes.get(clave) || 0) > Date.now() - 1500) return;
  recientes.set(clave, Date.now());
  const cuerpo = JSON.stringify({ token: destino.token, tipo, visitante, ...utm, pagina: location.href.slice(0, 500), referente: document.referrer.slice(0, 500), ...extra });
  const url = destino.endpoint.startsWith('http') ? destino.endpoint : BASE + destino.endpoint;
  try {
    if (tipo === 'clic_contacto' && navigator.sendBeacon && navigator.sendBeacon(url, new Blob([cuerpo], { type: 'text/plain' }))) return;
    void fetch(url, { method: 'POST', mode: 'cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: cuerpo }).catch(() => undefined);
  } catch { /* el seguimiento nunca rompe la página */ }
}

export const registrarVisita = (titulo: string) => enviar('visita', { datos: { titulo: titulo.slice(0, 200) } });
export const registrarProducto = (nombre: string, id: number) => enviar('producto', { producto_texto: nombre.slice(0, 200), datos: { producto_id: id } });
export const registrarContacto = (medio: 'whatsapp' | 'telefono' | 'correo', texto: string, producto?: string) =>
  enviar('clic_contacto', { producto_texto: producto, datos: { destino: medio, texto: texto.slice(0, 120) } });
