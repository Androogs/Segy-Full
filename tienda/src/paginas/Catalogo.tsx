// Catálogo: /catalogo, /catalogo/:grupo y búsqueda (?q=). Filtros por categoría, marca, orden y disponibilidad;
// todo vive en la dirección para que se pueda compartir el enlace de una búsqueda.
import { useEffect, useMemo, useState } from 'react';
import { obtener, qs } from '../lib/api';
import { useNegocio } from '../lib/negocio';
import { cambiarQuery, Enlace, useRuta } from '../lib/ruta';
import { usePagina } from '../lib/seo';
import { plural } from '../lib/formato';
import type { Grupo, ListaProductos, ProductoResumen } from '../lib/tipos';
import { TarjetaProducto, RejillaCargando } from '../componentes/TarjetaProducto';
import { ErrorCarga, Vacio } from '../componentes/Estados';

const GRUPOS_VALIDOS: Grupo[] = ['celulares', 'usados', 'accesorios', 'repuestos'];
const ORDENES = [
  { valor: 'relevancia', texto: 'Recomendados' },
  { valor: 'precio_asc', texto: 'Menor precio' },
  { valor: 'precio_desc', texto: 'Mayor precio' },
  { valor: 'recientes', texto: 'Más recientes' },
];
const POR_PAGINA = 24;

export function Catalogo() {
  const { partes, query } = useRuta();
  const { datos } = useNegocio();
  const grupo = GRUPOS_VALIDOS.includes(partes[1] as Grupo) ? (partes[1] as Grupo) : null;
  const q = query.get('q') || '';
  const categoria = query.get('categoria') || '';
  const marca = query.get('marca') || '';
  const orden = query.get('orden') || 'relevancia';
  const disponible = query.get('disponible') === '1';
  const ofertas = query.get('ofertas') === '1';
  const filtros = useMemo(() => ({ grupo, q, categoria, marca, orden, disponible, ofertas }), [grupo, q, categoria, marca, orden, disponible, ofertas]);
  const clave = JSON.stringify(filtros);

  const [pagina, setPagina] = useState(1);
  const [productos, setProductos] = useState<ProductoResumen[]>([]);
  const [meta, setMeta] = useState<Omit<ListaProductos, 'productos'> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => { setPagina(1); }, [clave]);
  useEffect(() => {
    let vivo = true;
    setCargando(true); setError(null);
    obtener<ListaProductos>(`/productos${qs({ ...filtros, disponible: filtros.disponible ? 1 : null, ofertas: filtros.ofertas ? 1 : null, limite: POR_PAGINA, pagina })}`)
      .then((d) => {
        if (!vivo) return;
        setProductos((prev) => (pagina === 1 ? d.productos : [...prev, ...d.productos]));
        const { productos: _p, ...resto } = d; void _p;
        setMeta(resto); setCargando(false);
      })
      .catch((e: Error) => { if (vivo) { setError(e.message); setCargando(false); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, pagina, vuelta]);

  const infoGrupo = datos?.grupos.find((g) => g.clave === grupo);
  const categoriaNombre = infoGrupo?.categorias.find((c) => String(c.id) === categoria)?.nombre
    || datos?.grupos.flatMap((g) => g.categorias).find((c) => String(c.id) === categoria)?.nombre;
  const titulo = q ? `Resultados para «${q}»` : ofertas ? 'Ofertas' : categoriaNombre || infoGrupo?.nombre || 'Todo el catálogo';
  usePagina(q ? `Buscar ${q}` : titulo, infoGrupo?.descripcion);
  const categorias = infoGrupo?.categorias ?? [];

  return (
    <div className="contenedor">
      <nav aria-label="Ruta"><ol className="migas"><li><Enlace a="/">Inicio</Enlace></li>{grupo && <li><Enlace a={`/catalogo/${grupo}`}>{infoGrupo?.nombre || grupo}</Enlace></li>}{categoriaNombre && <li>{categoriaNombre}</li>}</ol></nav>
      <header className="catalogo__cab" style={{ paddingTop: 0 }}>
        <div>
          <h1 className="titulo-1">{titulo}</h1>
          {infoGrupo && !q && !categoriaNombre && <p className="entrada" style={{ marginTop: 12 }}>{infoGrupo.descripcion}</p>}
        </div>
        {meta && <p className="secundario num">{plural(meta.total, 'producto', 'productos')}</p>}
      </header>

      <div className="filtros">
        <div className="filtros__fila">
          {categorias.length > 1 && (
            <>
              <button type="button" className="ficha" aria-pressed={!categoria} onClick={() => cambiarQuery({ categoria: null })}>Todo</button>
              {categorias.map((c) => <button key={c.id} type="button" className="ficha" aria-pressed={categoria === String(c.id)} onClick={() => cambiarQuery({ categoria: String(c.id) })}>{c.nombre} <span>{c.total}</span></button>)}
              <span className="separador" />
            </>
          )}
          {!grupo && !q && datos?.grupos.filter((g) => g.total > 0).map((g) => <Enlace key={g.clave} a={`/catalogo/${g.clave}`} className="ficha">{g.nombre} <span>{g.total}</span></Enlace>)}
          <div className="filtros__extra">
            {meta && meta.marcas.length > 1 && (
              <select value={marca} onChange={(e) => cambiarQuery({ marca: e.target.value || null })} aria-label="Marca">
                <option value="">Todas las marcas</option>
                {meta.marcas.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            <select value={orden} onChange={(e) => cambiarQuery({ orden: e.target.value === 'relevancia' ? null : e.target.value })} aria-label="Ordenar por">
              {ORDENES.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </select>
            <label className="casilla"><input type="checkbox" checked={disponible} onChange={(e) => cambiarQuery({ disponible: e.target.checked ? '1' : null })} />Solo disponibles</label>
          </div>
        </div>
      </div>

      {error ? <ErrorCarga mensaje={error} reintentar={() => setVuelta((v) => v + 1)} />
        : cargando && pagina === 1 ? <RejillaCargando />
        : productos.length === 0 ? (
          <Vacio titulo={q ? `No encontramos «${q}»` : 'No hay productos con estos filtros'} texto="Prueba con otra palabra o quita algún filtro. Si buscas algo puntual, escríbenos: lo conseguimos por encargo.">
            <button type="button" className="boton boton--claro" onClick={() => cambiarQuery({ categoria: null, marca: null, disponible: null, ofertas: null, q: null })}>Quitar filtros</button>
          </Vacio>
        ) : (
          <>
            <div className="rejilla-productos">{productos.map((p) => <TarjetaProducto key={p.id} producto={p} />)}</div>
            {meta && productos.length < meta.total && (
              <div className="mas-resultados">
                <span>Viendo {productos.length} de {meta.total}</span>
                <button type="button" className="boton boton--contorno" onClick={() => setPagina((p) => p + 1)} disabled={cargando}>{cargando ? 'Cargando…' : 'Ver más productos'}</button>
              </div>
            )}
          </>
        )}
      <div style={{ height: 96 }} />
    </div>
  );
}
