// Búsqueda instantánea: resultados mientras se escribe, navegación con flechas y Enter para ver todos.
import { useEffect, useRef, useState } from 'react';
import { obtener, qs } from '../lib/api';
import { pesos } from '../lib/formato';
import { navegar } from '../lib/ruta';
import { useNegocio } from '../lib/negocio';
import type { ListaProductos, ProductoResumen } from '../lib/tipos';
import { VisualProducto } from './VisualProducto';
import { Icono } from './Icono';

const SUGERENCIAS = ['iPhone', 'Samsung', 'Estuche', 'Vidrio templado', 'Cargador', 'Audífonos'];

export function Buscador({ cerrar }: { cerrar: () => void }) {
  const { datos } = useNegocio();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ProductoResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [sel, setSel] = useState(-1);
  const [cargando, setCargando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => { entrada.current?.focus(); document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setRes([]); setTotal(0); return; }
    let vivo = true;
    setCargando(true);
    const h = setTimeout(() => {
      obtener<ListaProductos>(`/productos${qs({ q: t, limite: 6 })}`)
        .then((d) => { if (vivo) { setRes(d.productos); setTotal(d.total); setSel(-1); setCargando(false); } })
        .catch(() => { if (vivo) setCargando(false); });
    }, 180);
    return () => { vivo = false; clearTimeout(h); };
  }, [q]);

  const irA = (a: string) => { cerrar(); navegar(a); };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(res.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(-1, s - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (sel >= 0 && res[sel]) irA(`/producto/${res[sel].slug}`);
      else if (q.trim()) irA(`/catalogo${qs({ q: q.trim() })}`);
    }
  };
  const marcas = [...new Set(datos?.destacados.map((p) => p.marca).filter((m): m is string => !!m && m !== 'Genérico') ?? [])];
  const sugerencias = [...new Set([...marcas, ...SUGERENCIAS])].slice(0, 7);

  return (
    <>
      <div className="capa" onClick={cerrar} />
      <div className="buscador" role="dialog" aria-modal="true" aria-label="Buscar productos" onKeyDown={teclas}>
        <div className="contenedor">
          <div className="buscador__barra">
            <Icono nombre="buscar" />
            <input ref={entrada} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué estás buscando?" aria-label="Buscar productos" role="combobox" aria-expanded={res.length > 0} aria-controls="buscador-resultados" aria-activedescendant={sel >= 0 ? `res-${sel}` : undefined} enterKeyHint="search" />
            <button type="button" className="cab__icono" onClick={cerrar} aria-label="Cerrar búsqueda"><Icono nombre="cerrar" /></button>
          </div>
          {q.trim().length < 2 ? (
            <div className="buscador__sugerencias">
              <span>Prueba con</span>
              {sugerencias.map((s) => <button key={s} type="button" className="ficha" onClick={() => setQ(s)}>{s}</button>)}
            </div>
          ) : (
            <div className="buscador__resultados" id="buscador-resultados" role="listbox">
              {res.map((p, i) => (
                <a key={p.id} id={`res-${i}`} role="option" aria-selected={i === sel} href={`/producto/${p.slug}`} className="buscador__resultado" onClick={(e) => { e.preventDefault(); irA(`/producto/${p.slug}`); }} onMouseEnter={() => setSel(i)}>
                  <VisualProducto producto={p} foto={p.foto} />
                  <div><div className="nombre">{p.nombre}</div><div className="chico terciario">{p.categoria?.nombre}{p.disponible ? '' : ', agotado'}</div></div>
                  <span className="precio">{pesos(p.precio)}</span>
                </a>
              ))}
              {!cargando && res.length === 0 && <p className="secundario" style={{ padding: '12px 8px' }}>No encontramos «{q.trim()}». Revisa la ortografía o escríbenos: lo conseguimos por encargo.</p>}
              {total > res.length && <button type="button" className="boton boton--contorno" style={{ justifySelf: 'start', marginTop: 8 }} onClick={() => irA(`/catalogo${qs({ q: q.trim() })}`)}>Ver los {total} resultados</button>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
