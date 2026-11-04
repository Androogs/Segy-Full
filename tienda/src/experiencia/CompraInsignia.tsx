// Último capítulo de la experiencia: precio real del panel, cuotas, disponibilidad y acciones de compra.
import { useCarrito } from '../lib/carrito';
import { useNegocio } from '../lib/negocio';
import { cuotaDesde, pesos } from '../lib/formato';
import { Enlace } from '../lib/ruta';
import { enlaceWhatsApp } from '../lib/whatsapp';
import { registrarContacto } from '../lib/seguimiento';
import type { ProductoDetalle } from '../lib/tipos';
import { INSIGNIA } from '../contenido/insignia';
import { Icono } from '../componentes/Icono';

export function CompraInsignia({ producto, acabado, oculto }: { producto: ProductoDetalle | null; acabado: string; oculto: boolean }) {
  const { datos } = useNegocio();
  const { agregar } = useCarrito();
  const tab = oculto ? -1 : 0;
  const wa = datos?.negocio.whatsapp || '';
  const credito = datos?.tienda.credito;

  if (!producto) {
    const mensaje = `Hola SEGY, quiero el ${INSIGNIA.titular} en ${acabado}. ¿Lo tienen disponible?`;
    return (
      <div className="compra">
        <h2 className="titulo-2">{INSIGNIA.titular}</h2>
        <p className="entrada">Pregúntanos por precio y disponibilidad: te respondemos por WhatsApp.</p>
        {wa && <a className="boton boton--primario boton--grande" href={enlaceWhatsApp(wa, mensaje)} target="_blank" rel="noopener" tabIndex={tab} onClick={() => registrarContacto('whatsapp', mensaje, INSIGNIA.titular)}><Icono nombre="mensaje" />Preguntar por WhatsApp</a>}
      </div>
    );
  }
  const cuota = credito?.activo ? cuotaDesde(producto.precio, credito.planes, credito.cuota_inicial_min_pct) : null;
  const mensaje = `Hola SEGY, me interesa el ${producto.nombre} en ${acabado}. ¿Me ayudan con la compra?`;
  return (
    <div className="compra">
      <p className="compra__nombre">{producto.nombre}</p>
      <div className="compra__precio">
        <span className="precio">{pesos(producto.precio)}</span>
        {producto.precio_antes && <span className="antes">{pesos(producto.precio_antes)}</span>}
      </div>
      {cuota && <p className="compra__cuota">o {cuota.cuotas} cuotas de <strong>{pesos(cuota.cuota)}</strong> con crédito SEGY, cuota inicial de {pesos(cuota.inicial)}.</p>}
      <p className="disponibilidad">
        <i className={`punto ${producto.disponible ? (producto.ultimas_unidades ? 'punto--aviso' : 'punto--ok') : 'punto--no'}`} />
        {producto.disponible ? (producto.ultimas_unidades ? 'Últimas unidades en Palmira' : 'Disponible hoy en Palmira') : 'Agotado por ahora: te avisamos cuando llegue'}
      </p>
      <div className="compra__acciones">
        {producto.disponible
          ? <button type="button" className="boton boton--primario boton--grande" onClick={() => agregar(producto)} tabIndex={tab}><Icono nombre="bolsa" />Agregar al carrito</button>
          : wa && <a className="boton boton--primario boton--grande" href={enlaceWhatsApp(wa, mensaje)} target="_blank" rel="noopener" tabIndex={tab}><Icono nombre="mensaje" />Avísame por WhatsApp</a>}
        <Enlace a={`/producto/${producto.slug}`} className="boton boton--contorno boton--grande" tabIndex={tab}>Ver ficha completa</Enlace>
      </div>
      <ul className="compra__extras">
        <li><Enlace a={`/retoma?producto=${producto.id}`} tabIndex={tab}><Icono nombre="retoma" />Entrega tu celular como parte de pago</Enlace></li>
        {wa && <li><a href={enlaceWhatsApp(wa, mensaje)} target="_blank" rel="noopener" tabIndex={tab} onClick={() => registrarContacto('whatsapp', mensaje, producto.nombre)}><Icono nombre="mensaje" />Habla con un asesor</a></li>}
      </ul>
    </div>
  );
}
