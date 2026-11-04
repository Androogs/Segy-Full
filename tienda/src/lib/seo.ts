// Título y descripción de cada página (pestaña del navegador, buscadores y vistas previas al compartir).
import { useEffect } from 'react';
import { registrarVisita } from './seguimiento';

const SUFIJO = 'SEGY';
const DESCRIPCION = 'Celulares nuevos y usados certificados, accesorios y repuestos en Palmira. Crédito a cuotas y retoma de tu celular.';

function meta(nombre: string, valor: string, atributo: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${nombre}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(atributo, nombre); document.head.appendChild(el); }
  el.content = valor;
}

export function usePagina(titulo: string | null, descripcion?: string | null): void {
  useEffect(() => {
    if (titulo === null) return;
    const completo = titulo ? `${titulo} | ${SUFIJO}` : 'SEGY: celulares, accesorios y servicio técnico en Palmira';
    document.title = completo;
    meta('description', descripcion || DESCRIPCION);
    meta('og:title', completo, 'property');
    meta('og:description', descripcion || DESCRIPCION, 'property');
    registrarVisita(completo);
  }, [titulo, descripcion]);
}
