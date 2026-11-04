// Enrutador mínimo sobre la History API: direcciones limpias (/producto/iphone-17-pro-max-256gb-1) que el backend
// resuelve devolviendo index.html. Sin dependencias externas.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const EVENTO = 'segy:navegar';
const suscribir = (fn: () => void) => {
  window.addEventListener('popstate', fn);
  window.addEventListener(EVENTO, fn);
  return () => { window.removeEventListener('popstate', fn); window.removeEventListener(EVENTO, fn); };
};
const instantanea = () => location.pathname + location.search;

export interface Ruta { camino: string; partes: string[]; query: URLSearchParams; completa: string }

export function useRuta(): Ruta {
  const completa = useSyncExternalStore(suscribir, instantanea, instantanea);
  const [camino, busqueda = ''] = completa.split('?');
  return { camino, partes: camino.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(busqueda), completa };
}

export function navegar(a: string, { reemplazar = false, conservarScroll = false } = {}): void {
  if (a === instantanea()) return;
  if (reemplazar) history.replaceState(null, '', a); else history.pushState(null, '', a);
  window.dispatchEvent(new Event(EVENTO));
  if (!conservarScroll) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

// Cambia parámetros de la consulta sin mover el scroll (filtros del catálogo).
export function cambiarQuery(cambios: Record<string, string | null>): void {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(cambios)) { if (v === null || v === '') p.delete(k); else p.set(k, v); }
  const s = p.toString();
  navegar(location.pathname + (s ? `?${s}` : ''), { reemplazar: true, conservarScroll: true });
}

type PropsEnlace = AnchorHTMLAttributes<HTMLAnchorElement> & { a: string };
export function Enlace({ a, onClick, children, ...resto }: PropsEnlace) {
  const alHacerClic = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || resto.target === '_blank') return;
    e.preventDefault();
    navegar(a);
  };
  return <a href={a} onClick={alHacerClic} {...resto}>{children}</a>;
}
