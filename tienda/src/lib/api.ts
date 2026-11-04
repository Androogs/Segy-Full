// Cliente de la API pública de la tienda. Sin cookies ni sesión: todo lo que se envía pasa por las validaciones y los
// límites del backend (/api/publico/tienda).

const BASE = (import.meta.env.VITE_SEGY_API || '').replace(/\/+$/, '');
const RAIZ = `${BASE}/api/publico/tienda`;

export class ErrorApi extends Error {
  status: number;
  codigo?: string;
  datos: Record<string, unknown>;
  constructor(status: number, datos: Record<string, unknown> | null) {
    super((datos && typeof datos.error === 'string' && datos.error) || (status === 0 ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.' : `Algo falló (${status}). Inténtalo de nuevo.`));
    this.status = status;
    this.datos = datos || {};
    this.codigo = typeof this.datos.codigo === 'string' ? this.datos.codigo : undefined;
  }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(ruta.startsWith('http') ? ruta : RAIZ + ruta, { ...init, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  } catch {
    throw new ErrorApi(0, null);
  }
  const texto = await r.text();
  let datos: unknown = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = null; }
  if (!r.ok) throw new ErrorApi(r.status, datos as Record<string, unknown> | null);
  return datos as T;
}

// Caché breve en memoria para que la navegación entre páginas ya visitadas sea inmediata.
const cache = new Map<string, { hasta: number; promesa: Promise<unknown> }>();
const VIGENCIA_MS = 60_000;

export function obtener<T>(ruta: string, { fresco = false } = {}): Promise<T> {
  const ahora = Date.now();
  const c = cache.get(ruta);
  if (!fresco && c && c.hasta > ahora) return c.promesa as Promise<T>;
  const promesa = pedir<T>(ruta);
  cache.set(ruta, { hasta: ahora + VIGENCIA_MS, promesa });
  promesa.catch(() => cache.delete(ruta));
  return promesa;
}

export function enviar<T>(ruta: string, cuerpo: unknown): Promise<T> {
  return pedir<T>(ruta, { method: 'POST', body: JSON.stringify(cuerpo) });
}

// Las fotos llegan como rutas relativas del backend (/api/publico/tienda/fotos/12).
export const urlMedia = (ruta: string | null | undefined): string | null => (ruta ? (ruta.startsWith('http') ? ruta : BASE + ruta) : null);

export const qs = (obj: Record<string, string | number | boolean | null | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
