// Pago (checkout) en una sola página: datos, entrega, forma de pago y, opcional, el celular que entregas como parte de pago.
// El servidor recalcula precios y existencias; el pedido llega al panel (Tienda web › Pedidos) y a Marketing.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { enviar, ErrorApi, obtener } from '../lib/api';
import { useCarrito } from '../lib/carrito';
import { useNegocio } from '../lib/negocio';
import { pesos } from '../lib/formato';
import { Enlace, navegar } from '../lib/ruta';
import { usePagina } from '../lib/seo';
import { origen } from '../lib/seguimiento';
import type { Entrega, Pago, PedidoCreado, ProductoDetalle } from '../lib/tipos';
import { VisualProducto } from '../componentes/VisualProducto';
import { Autorizacion, Campo, Texto } from '../componentes/Formulario';
import { SimuladorCuotas } from '../componentes/SimuladorCuotas';
import { Vacio } from '../componentes/Estados';

export function Pagar() {
  usePagina('Finalizar pedido');
  const { datos } = useNegocio();
  const { lineas, subtotal, vaciar, actualizarProductos, cerrar } = useCarrito();
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', email: '', documento: '' });
  const [entrega, setEntrega] = useState<Entrega>('recoger');
  const [dir, setDir] = useState({ ciudad: '', direccion: '', barrio: '' });
  const [pago, setPago] = useState<Pago>('tienda');
  const [cuotas, setCuotas] = useState<number | null>(null);
  const [conRetoma, setConRetoma] = useState(false);
  const [retoma, setRetoma] = useState({ marca: '', modelo: '', capacidad: '', estado: '' });
  const [notas, setNotas] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  useEffect(() => { cerrar(); }, [cerrar]);
  // Precios y disponibilidad frescos antes de pagar.
  useEffect(() => {
    if (!lineas.length) return;
    let vivo = true;
    Promise.allSettled(lineas.map((l) => obtener<ProductoDetalle>(`/productos/${l.producto.slug}`, { fresco: true }))).then((r) => {
      if (!vivo) return;
      const nuevos: ProductoDetalle[] = []; const msj: string[] = [];
      r.forEach((x, i) => {
        const antes = lineas[i].producto;
        if (x.status === 'fulfilled') {
          nuevos.push(x.value);
          if (x.value.precio !== antes.precio) msj.push(`El precio de ${antes.nombre} cambió a ${pesos(x.value.precio)}.`);
          if (!x.value.disponible) msj.push(`${antes.nombre} se agotó: quítalo para continuar.`);
        } else msj.push(`${antes.nombre} ya no está disponible en la tienda: quítalo para continuar.`);
      });
      if (nuevos.length) actualizarProductos(nuevos);
      setAvisos(msj);
    });
    return () => { vivo = false; };
    // Solo al entrar a la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tienda = datos?.tienda;
  const envio = tienda?.envio;
  const credito = tienda?.credito;
  const pagosDisponibles = useMemo(() => (tienda?.pagos ?? []).filter((p) => (p.clave !== 'contraentrega' || entrega === 'local') && (p.clave !== 'tienda' || entrega === 'recoger') && (p.clave !== 'credito' || credito?.activo)), [tienda, entrega, credito]);
  useEffect(() => { if (pagosDisponibles.length && !pagosDisponibles.some((p) => p.clave === pago)) setPago(pagosDisponibles[0].clave); }, [pagosDisponibles, pago]);

  const costoEnvio = (): { valor: number; confirmar: boolean } => {
    if (entrega === 'recoger' || !envio) return { valor: 0, confirmar: false };
    if (envio.gratis_desde && subtotal >= envio.gratis_desde) return { valor: 0, confirmar: false };
    const c = entrega === 'local' ? envio.local_costo : envio.nacional_costo;
    return c === null || c === undefined ? { valor: 0, confirmar: true } : { valor: c, confirmar: false };
  };
  const ce = costoEnvio();
  const total = subtotal + ce.valor;
  const ciudadLocal = datos?.negocio.ciudad.split(',')[0] || 'la ciudad';
  const guardarCuotas = useCallback((n: number) => setCuotas(n), []);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acepta) { setError('Marca la autorización de datos para poder tomar tu pedido.'); return; }
    if (lineas.some((l) => !l.producto.disponible)) { setError('Hay productos agotados en tu carrito. Quítalos para continuar.'); return; }
    setEnviando(true);
    try {
      const r = await enviar<PedidoCreado>('/pedidos', {
        acepta_datos: true,
        cliente,
        entrega: { tipo: entrega, ciudad: entrega === 'local' ? ciudadLocal : dir.ciudad, direccion: dir.direccion, barrio: dir.barrio },
        pago,
        credito_cuotas: pago === 'credito' ? cuotas ?? credito?.planes[credito.planes.length - 1]?.cuotas : undefined,
        retoma: conRetoma ? retoma : undefined,
        notas,
        items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
        ...origen(),
      });
      vaciar();
      navegar(`/pedido/${r.token}?nuevo=1`);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No pudimos enviar el pedido. Inténtalo de nuevo.');
      setEnviando(false);
    }
  }

  if (!lineas.length) return <div className="contenedor" style={{ padding: '48px 0 96px' }}><Vacio titulo="No hay nada para pagar todavía" texto="Agrega productos al carrito y vuelve aquí."><Enlace a="/catalogo" className="boton boton--claro">Ir al catálogo</Enlace></Vacio></div>;

  return (
    <div className="contenedor" style={{ paddingBottom: 96 }}>
      <header className="catalogo__cab"><div><h1 className="titulo-1">Finalizar pedido</h1><p className="entrada" style={{ marginTop: 12 }}>Te confirmamos por WhatsApp antes de cobrarte. No necesitas crear una cuenta.</p></div></header>
      <form className="dos-columnas" onSubmit={confirmar} noValidate>
        <div>
          {avisos.length > 0 && <div className="aviso" role="status" style={{ marginBottom: 24 }}>{avisos.map((a) => <p key={a}>{a}</p>)}</div>}
          <section className="paso" aria-labelledby="p1">
            <h2 id="p1" className="titulo-3">Tus datos</h2>
            <div className="rejilla-campos">
              <Campo etiqueta="Nombre completo" autoComplete="name" required value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} ancho />
              <Campo etiqueta="Celular o WhatsApp" type="tel" inputMode="tel" autoComplete="tel" required placeholder="300 123 4567" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
              <Campo etiqueta="Correo (opcional)" type="email" autoComplete="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
              <Campo etiqueta="Cédula (opcional)" inputMode="numeric" value={cliente.documento} onChange={(e) => setCliente({ ...cliente, documento: e.target.value })} ayuda="La necesitamos para la factura y si pagas con crédito." ancho />
            </div>
          </section>

          <section className="paso" aria-labelledby="p2">
            <h2 id="p2" className="titulo-3">Entrega</h2>
            <div className="opciones" role="radiogroup">
              <label className="opcion"><input type="radio" name="entrega" checked={entrega === 'recoger'} onChange={() => setEntrega('recoger')} /><div><strong>Recoger en la tienda</strong><span>{datos?.negocio.direccion ? `${datos.negocio.direccion}, ${datos.negocio.ciudad}` : 'Te avisamos cuando esté listo'}. Sin costo.</span></div></label>
              <label className="opcion"><input type="radio" name="entrega" checked={entrega === 'local'} onChange={() => setEntrega('local')} /><div><strong>{envio?.local_nombre || 'Domicilio local'}</strong><span>{envio?.local_costo != null ? pesos(envio.local_costo) : 'Te confirmamos el valor por WhatsApp'}{envio?.gratis_desde ? `. Gratis desde ${pesos(envio.gratis_desde)}` : ''}.</span></div></label>
              {envio?.nacional && <label className="opcion"><input type="radio" name="entrega" checked={entrega === 'nacional'} onChange={() => setEntrega('nacional')} /><div><strong>Envío a otra ciudad</strong><span>{envio.nacional_costo != null ? pesos(envio.nacional_costo) : 'Te confirmamos el valor y la transportadora'}.</span></div></label>}
            </div>
            {entrega !== 'recoger' && (
              <div className="rejilla-campos" style={{ marginTop: 16 }}>
                {entrega === 'nacional' && <Campo etiqueta="Ciudad" autoComplete="address-level2" required value={dir.ciudad} onChange={(e) => setDir({ ...dir, ciudad: e.target.value })} />}
                <Campo etiqueta="Dirección" autoComplete="street-address" required value={dir.direccion} onChange={(e) => setDir({ ...dir, direccion: e.target.value })} ancho={entrega === 'local'} />
                <Campo etiqueta="Barrio y referencias" value={dir.barrio} onChange={(e) => setDir({ ...dir, barrio: e.target.value })} ancho />
              </div>
            )}
          </section>

          <section className="paso" aria-labelledby="p3">
            <h2 id="p3" className="titulo-3">Forma de pago</h2>
            <div className="opciones" role="radiogroup">
              {pagosDisponibles.map((p) => (
                <label key={p.clave} className="opcion"><input type="radio" name="pago" checked={pago === p.clave} onChange={() => setPago(p.clave)} />
                  <div><strong>{p.nombre}</strong><span>{
                    p.clave === 'transferencia' ? 'Te enviamos los datos de pago al confirmar el pedido.'
                    : p.clave === 'contraentrega' ? 'Pagas al recibir, en efectivo o transferencia.'
                    : p.clave === 'tienda' ? 'Pagas cuando lo recoges, con el medio que prefieras.'
                    : 'Paga a cuotas. Un asesor revisa tu solicitud antes de entregarte el equipo.'
                  }</span></div>
                </label>
              ))}
            </div>
            {pago === 'credito' && credito && <div style={{ marginTop: 16 }}><SimuladorCuotas precio={subtotal} credito={credito} titulo="Tu plan de cuotas" alCambiar={guardarCuotas} /></div>}
          </section>

          <section className="paso" aria-labelledby="p4">
            <h2 id="p4" className="titulo-3">¿Entregas un celular como parte de pago?</h2>
            <label className="casilla" style={{ marginBottom: 14 }}><input type="checkbox" checked={conRetoma} onChange={(e) => setConRetoma(e.target.checked)} /><span>Sí, quiero que lo revisen y lo descuenten de este pedido.</span></label>
            {conRetoma && (
              <div className="rejilla-campos">
                <Campo etiqueta="Marca" value={retoma.marca} onChange={(e) => setRetoma({ ...retoma, marca: e.target.value })} placeholder="Apple, Samsung…" />
                <Campo etiqueta="Modelo" value={retoma.modelo} onChange={(e) => setRetoma({ ...retoma, modelo: e.target.value })} placeholder="iPhone 13" />
                <Campo etiqueta="Capacidad" value={retoma.capacidad} onChange={(e) => setRetoma({ ...retoma, capacidad: e.target.value })} placeholder="128 GB" />
                <Campo etiqueta="Cómo está" value={retoma.estado} onChange={(e) => setRetoma({ ...retoma, estado: e.target.value })} placeholder="Pantalla perfecta, batería 85 %" />
              </div>
            )}
            <div style={{ marginTop: 16 }}><Texto etiqueta="Notas para el pedido (opcional)" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Color preferido, horario de entrega…" /></div>
          </section>
        </div>

        <aside className="resumen" aria-label="Resumen del pedido">
          <h2 className="titulo-3">Resumen</h2>
          {lineas.map((l) => (
            <div key={l.producto.id} className="resumen__linea"><VisualProducto producto={l.producto} foto={l.producto.foto} /><span>{l.cantidad} × {l.producto.nombre}</span><span className="num">{pesos(l.producto.precio * l.cantidad)}</span></div>
          ))}
          <dl className="resumen__filas">
            <dt>Subtotal</dt><dd>{pesos(subtotal)}</dd>
            <dt>Envío</dt><dd>{entrega === 'recoger' ? 'Sin costo' : ce.confirmar ? 'Por confirmar' : ce.valor ? pesos(ce.valor) : 'Gratis'}</dd>
          </dl>
          <div className="resumen__total"><span>Total</span><span className="precio">{pesos(total)}</span></div>
          <Autorizacion marcado={acepta} cambiar={setAcepta} />
          {error && <div className="aviso aviso--error" role="alert">{error}</div>}
          <button type="submit" className="boton boton--primario boton--grande boton--bloque" disabled={enviando}>{enviando ? 'Enviando pedido…' : 'Enviar pedido'}</button>
          <p className="chico terciario">Al enviarlo no se hace ningún cobro. Te escribimos para confirmar disponibilidad, entrega y pago. Aplica la <Enlace a="/legal/terminos" className="enlace">política de compra</Enlace> y el derecho de retracto.</p>
        </aside>
      </form>
    </div>
  );
}
