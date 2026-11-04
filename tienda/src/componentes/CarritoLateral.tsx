// Carrito lateral: se abre al agregar un producto. Permite ajustar cantidades y seguir al pago.
import { useEffect, useRef } from 'react';
import { useCarrito } from '../lib/carrito';
import { pesos } from '../lib/formato';
import { Enlace, navegar } from '../lib/ruta';
import { VisualProducto } from './VisualProducto';
import { Icono } from './Icono';
import { Vacio } from './Estados';

export function Cantidad({ valor, max, cambiar, nombre }: { valor: number; max: number; cambiar: (n: number) => void; nombre: string }) {
  return (
    <div className="cantidad" role="group" aria-label={`Cantidad de ${nombre}`}>
      <button type="button" onClick={() => cambiar(valor - 1)} disabled={valor <= 1} aria-label="Quitar una unidad"><Icono nombre="menos" /></button>
      <output aria-live="polite">{valor}</output>
      <button type="button" onClick={() => cambiar(valor + 1)} disabled={valor >= max} aria-label="Agregar una unidad"><Icono nombre="mas" /></button>
    </div>
  );
}

export function CarritoLateral() {
  const { lineas, abierto, cerrar, subtotal, cambiar, quitar, unidades } = useCarrito();
  const cerrarBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!abierto) return;
    cerrarBtn.current?.focus();
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [abierto, cerrar]);
  if (!abierto) return null;
  const ir = (a: string) => { cerrar(); navegar(a); };
  return (
    <>
      <div className="capa" onClick={cerrar} />
      <aside className="lateral" role="dialog" aria-modal="true" aria-label="Tu carrito">
        <div className="lateral__cab">
          <h2 className="titulo-3">Tu carrito {unidades > 0 && <span className="terciario num">({unidades})</span>}</h2>
          <button ref={cerrarBtn} type="button" className="cab__icono" onClick={cerrar} aria-label="Cerrar carrito"><Icono nombre="cerrar" /></button>
        </div>
        <div className="lateral__cuerpo">
          {lineas.length === 0 ? (
            <Vacio titulo="Tu carrito está vacío" texto="Agrega un celular o un accesorio y aquí lo verás.">
              <button type="button" className="boton boton--claro" onClick={() => ir('/catalogo/celulares')}>Ver celulares</button>
            </Vacio>
          ) : lineas.map(({ producto: p, cantidad }) => (
            <div key={p.id} className="linea-carrito">
              <VisualProducto producto={p} foto={p.foto} />
              <div>
                <Enlace a={`/producto/${p.slug}`} className="linea-carrito__nombre" onClick={cerrar}>{p.nombre}</Enlace>
                <div className="linea-carrito__meta">{pesos(p.precio)} c/u</div>
                <div className="linea-carrito__fila">
                  <Cantidad valor={cantidad} max={Math.max(1, Math.min(10, p.disponibles))} cambiar={(n) => cambiar(p.id, n)} nombre={p.nombre} />
                  <span className="precio">{pesos(p.precio * cantidad)}</span>
                </div>
                <button type="button" className="linea-carrito__quitar" onClick={() => quitar(p.id)}>Quitar</button>
              </div>
            </div>
          ))}
        </div>
        {lineas.length > 0 && (
          <div className="lateral__pie">
            <div className="lateral__total"><span className="secundario">Subtotal</span><span className="precio">{pesos(subtotal)}</span></div>
            <p className="chico terciario">El envío y la forma de pago los eliges en el siguiente paso.</p>
            <button type="button" className="boton boton--primario boton--grande boton--bloque" onClick={() => ir('/pagar')}>Continuar con el pedido</button>
            <button type="button" className="boton boton--fantasma boton--bloque" onClick={cerrar}>Seguir comprando</button>
          </div>
        )}
      </aside>
    </>
  );
}
