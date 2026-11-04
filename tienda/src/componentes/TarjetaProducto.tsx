// Tarjeta de producto para rejillas y carriles. Toda la tarjeta lleva a la ficha; el botón redondo agrega al carrito.
import { useCarrito } from '../lib/carrito';
import { useNegocio } from '../lib/negocio';
import { cuotaDesde, pesos } from '../lib/formato';
import { Enlace } from '../lib/ruta';
import type { ProductoResumen } from '../lib/tipos';
import { VisualProducto } from './VisualProducto';
import { Icono } from './Icono';

export function textoDisponibilidad(p: ProductoResumen): { texto: string; clase: string } {
  if (!p.disponible) return { texto: 'Agotado', clase: 'punto--no' };
  if (p.ultimas_unidades) return { texto: 'Últimas unidades', clase: 'punto--aviso' };
  return { texto: 'Disponible', clase: 'punto--ok' };
}

export function TarjetaProducto({ producto: p }: { producto: ProductoResumen }) {
  const { agregar } = useCarrito();
  const { datos } = useNegocio();
  const credito = datos?.tienda.credito;
  const financiable = (p.grupo === 'celulares' || p.grupo === 'usados') && credito?.activo;
  const cuota = financiable && credito ? cuotaDesde(p.precio, credito.planes, credito.cuota_inicial_min_pct) : null;
  const disp = textoDisponibilidad(p);
  const enlace = `/producto/${p.slug}`;
  return (
    <article className={`tarjeta${p.disponible ? '' : ' tarjeta--agotada'}`}>
      <div className="tarjeta__insignias">
        {p.grado && <span className="insignia insignia--grado">Grado {p.grado}</span>}
        {p.precio_antes && <span className="insignia insignia--rojo">Oferta</span>}
      </div>
      <Enlace a={enlace} className="tarjeta__visual" tabIndex={-1} aria-hidden="true"><VisualProducto producto={p} foto={p.foto} /></Enlace>
      <div className="tarjeta__cuerpo">
        {p.marca && p.marca !== 'Genérico' && <span className="tarjeta__marca">{p.marca}</span>}
        <h3 className="tarjeta__nombre"><Enlace a={enlace}>{p.nombre}</Enlace></h3>
        <div className="tarjeta__precios">
          <span className="precio">{pesos(p.precio)}</span>
          {p.precio_antes && <span className="antes">{pesos(p.precio_antes)}</span>}
        </div>
        {cuota && <span className="tarjeta__cuota">o {cuota.cuotas} cuotas de {pesos(cuota.cuota)}</span>}
        <div className="tarjeta__pie">
          <span className="disponibilidad"><i className={`punto ${disp.clase}`} />{disp.texto}</span>
          {p.disponible && (
            <button type="button" className="tarjeta__agregar" onClick={() => agregar(p)} aria-label={`Agregar ${p.nombre} al carrito`} title="Agregar al carrito">
              <Icono nombre="mas" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function RejillaCargando({ n = 8 }: { n?: number }) {
  return (
    <div className="rejilla-productos" aria-busy="true" aria-label="Cargando productos">
      {Array.from({ length: n }, (_, i) => (
        <div key={i}><div className="esqueleto" style={{ aspectRatio: '1 / 1.08', borderRadius: 16 }} /><div className="esqueleto" style={{ height: 14, marginTop: 16, width: '70%' }} /><div className="esqueleto" style={{ height: 22, marginTop: 10, width: '45%' }} /></div>
      ))}
    </div>
  );
}
