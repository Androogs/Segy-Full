// Página del carrito (además del carrito lateral): útil en el celular y para revisar antes de pagar.
import { useCarrito } from '../lib/carrito';
import { pesos } from '../lib/formato';
import { Enlace } from '../lib/ruta';
import { usePagina } from '../lib/seo';
import { VisualProducto } from '../componentes/VisualProducto';
import { Cantidad } from '../componentes/CarritoLateral';
import { Vacio } from '../componentes/Estados';

export function Carrito() {
  const { lineas, subtotal, cambiar, quitar, unidades } = useCarrito();
  usePagina('Tu carrito');
  return (
    <div className="contenedor" style={{ paddingBottom: 96 }}>
      <header className="catalogo__cab"><h1 className="titulo-1">Tu carrito</h1>{unidades > 0 && <p className="secundario">{unidades} {unidades === 1 ? 'producto' : 'productos'}</p>}</header>
      {lineas.length === 0 ? (
        <Vacio titulo="Tu carrito está vacío" texto="Mira lo que tenemos disponible hoy."><Enlace a="/catalogo" className="boton boton--claro">Ir al catálogo</Enlace></Vacio>
      ) : (
        <div className="dos-columnas">
          <div>
            {lineas.map(({ producto: p, cantidad }) => (
              <div key={p.id} className="linea-carrito" style={{ gridTemplateColumns: '96px minmax(0,1fr)' }}>
                <VisualProducto producto={p} foto={p.foto} className="" />
                <div>
                  <Enlace a={`/producto/${p.slug}`} className="linea-carrito__nombre">{p.nombre}</Enlace>
                  <div className="linea-carrito__meta">{pesos(p.precio)} c/u{p.disponible ? '' : ', agotado'}</div>
                  <div className="linea-carrito__fila">
                    <Cantidad valor={cantidad} max={Math.max(1, Math.min(10, p.disponibles))} cambiar={(n) => cambiar(p.id, n)} nombre={p.nombre} />
                    <span className="precio">{pesos(p.precio * cantidad)}</span>
                  </div>
                  <button type="button" className="linea-carrito__quitar" onClick={() => quitar(p.id)}>Quitar</button>
                </div>
              </div>
            ))}
          </div>
          <aside className="resumen">
            <div className="resumen__total"><span>Subtotal</span><span className="precio">{pesos(subtotal)}</span></div>
            <p className="chico terciario">Eliges la entrega y la forma de pago en el siguiente paso. Los precios se confirman al enviar el pedido.</p>
            <Enlace a="/pagar" className="boton boton--primario boton--grande boton--bloque">Continuar con el pedido</Enlace>
            <Enlace a="/catalogo" className="boton boton--fantasma boton--bloque">Seguir comprando</Enlace>
          </aside>
        </div>
      )}
    </div>
  );
}
