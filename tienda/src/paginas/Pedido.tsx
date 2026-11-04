// Seguimiento de un pedido con su enlace privado (/pedido/:token). Muestra el estado, los productos y el siguiente paso.
import { obtener } from '../lib/api';
import { useNegocio } from '../lib/negocio';
import { fechaLarga, pesos } from '../lib/formato';
import { Enlace, useRuta } from '../lib/ruta';
import { usePagina } from '../lib/seo';
import { usarDatos } from '../lib/usarDatos';
import { enlaceWhatsApp } from '../lib/whatsapp';
import type { PedidoPublico } from '../lib/tipos';
import { Icono } from '../componentes/Icono';
import { ErrorCarga } from '../componentes/Estados';
import { NoEncontrada } from './NoEncontrada';

function etapas(p: PedidoPublico): { estado: string; texto: string }[] {
  const lista = [{ estado: 'nuevo', texto: 'Recibido' }, { estado: 'confirmado', texto: 'Confirmado' }];
  if (p.pago === 'transferencia') lista.push({ estado: 'pagado', texto: 'Pago recibido' });
  lista.push(p.entrega === 'recoger' ? { estado: 'listo', texto: 'Listo para recoger' } : { estado: 'enviado', texto: 'En camino' });
  lista.push({ estado: 'entregado', texto: 'Entregado' });
  return lista;
}

export function Pedido() {
  const { partes, query } = useRuta();
  const token = partes[1] || '';
  const { datos: negocio } = useNegocio();
  const { datos: p, error, status, reintentar } = usarDatos<PedidoPublico>(() => obtener<PedidoPublico>(`/pedidos/${token}`, { fresco: true }), [token]);
  usePagina(p ? `Pedido ${p.numero}` : 'Tu pedido');
  if (status === 404) return <NoEncontrada titulo="No encontramos este pedido" texto="Revisa que el enlace esté completo. Si necesitas ayuda, escríbenos con tu número de pedido." />;
  if (error) return <ErrorCarga mensaje={error} reintentar={reintentar} />;
  if (!p) return <div className="contenedor" style={{ padding: '64px 0' }}><div className="esqueleto" style={{ height: 120 }} /></div>;

  const nuevo = query.get('nuevo') === '1';
  const pasos = etapas(p);
  const hechos = new Set(p.historial.map((h) => h.estado));
  const indiceActual = pasos.findIndex((e) => e.estado === p.estado);
  const fechaDe = (estado: string) => p.historial.filter((h) => h.estado === estado).slice(-1)[0]?.fecha;
  const wa = negocio?.negocio.whatsapp;
  const mensaje = `Hola SEGY, escribo por mi pedido ${p.numero}.`;
  const siguiente = p.estado === 'cancelado' ? 'Este pedido fue cancelado. Si fue un error, escríbenos y lo retomamos.'
    : p.estado === 'nuevo' ? `Un asesor te escribe por WhatsApp para confirmar disponibilidad${p.pago === 'transferencia' ? ' y enviarte los datos de pago' : ''}${p.envio_por_confirmar ? ' y el valor del envío' : ''}.`
    : p.estado === 'listo' ? 'Tu pedido te espera en la tienda. Trae tu cédula.'
    : p.estado === 'enviado' ? 'Tu pedido va en camino.' : p.estado === 'entregado' ? 'Gracias por comprar en SEGY.' : 'Seguimos con tu pedido; te avisamos en cada paso.';

  return (
    <div className="contenedor" style={{ padding: '32px var(--margen) 96px' }}>
      {nuevo && (
        <div className="pedido-ok" role="status">
          <img src="/marca/astro.webp" alt="" />
          <div className="pila"><h1 className="titulo-2">¡Recibimos tu pedido, {p.nombre}!</h1><p className="secundario">Número {p.numero}. Guarda esta página: con este enlace puedes ver el estado cuando quieras.</p></div>
        </div>
      )}
      <div className="dos-columnas">
        <div className="pila">
          {!nuevo && <h1 className="titulo-1">Pedido {p.numero}</h1>}
          <p className="entrada">{siguiente}</p>
          {p.estado !== 'cancelado' && (
            <ol className="linea-tiempo" style={{ marginTop: 24 }}>
              {pasos.map((e, i) => {
                const hecho = hechos.has(e.estado) || i < indiceActual;
                const actual = e.estado === p.estado;
                const f = fechaDe(e.estado);
                return <li key={e.estado} className={actual ? 'actual' : hecho ? 'hecho' : ''} aria-current={actual ? 'step' : undefined}><i>{(hecho || actual) && <Icono nombre="check" />}</i><div><strong>{e.texto}</strong>{f && <span>{fechaLarga(f)}</span>}</div></li>;
              })}
            </ol>
          )}
          <div className="fila">
            {wa && <a className="boton boton--claro" href={enlaceWhatsApp(wa, mensaje)} target="_blank" rel="noopener"><Icono nombre="mensaje" />Escribir sobre mi pedido</a>}
            <Enlace a="/catalogo" className="boton boton--contorno">Seguir comprando</Enlace>
          </div>
        </div>
        <aside className="resumen">
          <h2 className="titulo-3">Detalle</h2>
          {p.items.map((i) => <div key={i.producto_id} className="fila" style={{ justifyContent: 'space-between', fontSize: 'var(--t-1)' }}><Enlace a={`/producto/${i.slug}`}>{i.cantidad} × {i.nombre}</Enlace><span className="num">{pesos(i.total)}</span></div>)}
          <dl className="resumen__filas">
            <dt>Subtotal</dt><dd>{pesos(p.subtotal)}</dd>
            <dt>Envío</dt><dd>{p.entrega === 'recoger' ? 'Sin costo' : p.envio_por_confirmar ? 'Por confirmar' : pesos(p.envio)}</dd>
            <dt>Entrega</dt><dd>{p.entrega_texto}{p.ciudad ? `, ${p.ciudad}` : ''}</dd>
            <dt>Pago</dt><dd>{p.pago_texto}{p.credito_cuotas ? `, ${p.credito_cuotas} cuotas` : ''}</dd>
            <dt>Fecha</dt><dd>{fechaLarga(p.fecha)}</dd>
          </dl>
          <div className="resumen__total"><span>Total</span><span className="precio">{pesos(p.total)}</span></div>
        </aside>
      </div>
    </div>
  );
}
