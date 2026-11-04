// Encabezado: barra de mensajes (editable en el panel), navegación por grupos del catálogo y servicios, búsqueda y
// carrito. En pantallas pequeñas, menú a pantalla completa.
import { useEffect, useState } from 'react';
import { useNegocio } from '../lib/negocio';
import { useCarrito } from '../lib/carrito';
import { Enlace, useRuta } from '../lib/ruta';
import { Icono } from './Icono';
import { Buscador } from './Buscador';
import { INSIGNIA } from '../contenido/insignia';

const SERVICIOS = [
  { a: '/retoma', texto: 'Retoma' },
  { a: '/credito', texto: 'Crédito' },
  { a: '/servicio-tecnico', texto: 'Servicio técnico' },
];

function BarraMensajes({ mensajes }: { mensajes: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (mensajes.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % mensajes.length), 5000);
    return () => clearInterval(t);
  }, [mensajes.length]);
  if (!mensajes.length) return null;
  return <div className="barra-mensajes" role="region" aria-label="Avisos"><p key={i}>{mensajes[i % mensajes.length]}</p></div>;
}

export function Encabezado() {
  const { datos } = useNegocio();
  const { unidades, abrir } = useCarrito();
  const { camino } = useRuta();
  const [menu, setMenu] = useState(false);
  const [buscar, setBuscar] = useState(false);
  const grupos = datos?.grupos.filter((g) => g.total > 0) ?? [];
  const accesorios = grupos.find((g) => g.clave === 'accesorios');

  useEffect(() => { setMenu(false); setBuscar(false); }, [camino]);
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) { e.preventDefault(); setBuscar(true); }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, []);
  useEffect(() => { document.body.style.overflow = menu ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [menu]);

  const actual = (a: string) => (camino === a || camino.startsWith(a + '/') ? 'page' : undefined);

  return (
    <>
      <BarraMensajes mensajes={datos?.tienda.mensajes_barra ?? []} />
      <header className="cab">
        <div className="contenedor cab__dentro">
          <button type="button" className="cab__icono cab__hamburguesa" onClick={() => setMenu(true)} aria-label="Abrir menú" aria-expanded={menu}><Icono nombre="menu" /></button>
          <Enlace a="/" className="cab__marca" aria-label="SEGY, ir al inicio"><img src="/marca/logo-segy.webp" alt="SEGY" width="46" height="46" /></Enlace>
          <nav className="cab__nav" aria-label="Principal">
            {datos?.insignia && <Enlace a={`/producto/${datos.insignia.slug}`} aria-current={actual(`/producto/${datos.insignia.slug}`)}>{INSIGNIA.titular}</Enlace>}
            {grupos.map((g) => g.clave === 'accesorios' && accesorios && accesorios.categorias.length > 1 ? (
              <div className="cab__menu" key={g.clave}>
                <Enlace a="/catalogo/accesorios" aria-current={actual('/catalogo/accesorios')} aria-haspopup="true">{g.nombre}</Enlace>
                <div className="cab__panel">
                  {accesorios.categorias.map((c) => <Enlace key={c.id} a={`/catalogo/accesorios?categoria=${c.id}`}>{c.nombre}<span>{c.total}</span></Enlace>)}
                  <Enlace a="/catalogo/accesorios" className="todo">Ver todos los accesorios</Enlace>
                </div>
              </div>
            ) : <Enlace key={g.clave} a={`/catalogo/${g.clave}`} aria-current={actual(`/catalogo/${g.clave}`)}>{g.nombre}</Enlace>)}
            {SERVICIOS.map((s) => <Enlace key={s.a} a={s.a} aria-current={actual(s.a)}>{s.texto}</Enlace>)}
          </nav>
          <div className="cab__acciones">
            <button type="button" className="cab__icono" onClick={() => setBuscar(true)} aria-label="Buscar productos" title="Buscar ( / )"><Icono nombre="buscar" /></button>
            <Enlace a="/tienda" className="cab__icono" aria-label="Visítanos en la tienda" title="Visítanos"><Icono nombre="ubicacion" /></Enlace>
            <button type="button" className="cab__icono" onClick={abrir} aria-label={`Carrito, ${unidades} ${unidades === 1 ? 'producto' : 'productos'}`}>
              <Icono nombre="bolsa" />{unidades > 0 && <span className="cab__contador">{unidades > 99 ? '99+' : unidades}</span>}
            </button>
          </div>
        </div>
      </header>

      {menu && (
        <div className="menu-movil" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="menu-movil__cab">
            <img src="/marca/logo-segy.webp" alt="SEGY" />
            <button type="button" className="cab__icono" onClick={() => setMenu(false)} aria-label="Cerrar menú" autoFocus><Icono nombre="cerrar" /></button>
          </div>
          <nav aria-label="Menú del celular">
            {datos?.insignia && <Enlace a={`/producto/${datos.insignia.slug}`}>{INSIGNIA.titular}</Enlace>}
            {grupos.map((g) => <Enlace key={g.clave} a={`/catalogo/${g.clave}`}>{g.nombre}<small>{g.total}</small></Enlace>)}
            {SERVICIOS.map((s) => <Enlace key={s.a} a={s.a}>{s.texto}</Enlace>)}
            <Enlace a="/tienda">Visítanos</Enlace>
          </nav>
          <div className="menu-movil__pie">
            <button type="button" className="boton boton--contorno boton--bloque" onClick={() => { setMenu(false); setBuscar(true); }}><Icono nombre="buscar" />Buscar productos</button>
          </div>
        </div>
      )}
      {buscar && <Buscador cerrar={() => setBuscar(false)} />}
    </>
  );
}
