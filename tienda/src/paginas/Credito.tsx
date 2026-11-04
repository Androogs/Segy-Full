// Crédito SEGY: simulador con los planes configurados en el panel y solicitud que llega como cliente potencial.
import { useCallback, useEffect, useState } from 'react';
import { obtener } from '../lib/api';
import { useNegocio } from '../lib/negocio';
import { useRuta, Enlace } from '../lib/ruta';
import { usePagina } from '../lib/seo';
import { usarDatos } from '../lib/usarDatos';
import { pesos } from '../lib/formato';
import type { ProductoDetalle } from '../lib/tipos';
import { SimuladorCuotas } from '../componentes/SimuladorCuotas';
import { Autorizacion, Campo, CamposContacto, contactoVacio, useSolicitud } from '../componentes/Formulario';
import { Vacio } from '../componentes/Estados';

export function Credito() {
  usePagina('Crédito SEGY', 'Compra tu celular a cuotas con crédito directo de SEGY. Simula tu cuota y solicítalo en línea.');
  const { datos } = useNegocio();
  const { query } = useRuta();
  const productoId = query.get('producto') || (datos?.insignia ? String(datos.insignia.id) : null);
  const { datos: producto } = usarDatos<ProductoDetalle>(productoId ? () => obtener<ProductoDetalle>(`/productos/${productoId}`) : null, [productoId]);
  const [valor, setValor] = useState('');
  useEffect(() => { if (producto) setValor(String(producto.precio)); }, [producto]);
  const [cuotas, setCuotas] = useState(0);
  const guardar = useCallback((n: number) => setCuotas(n), []);
  const [c, setC] = useState(contactoVacio);
  const [ocupacion, setOcupacion] = useState('');
  const [acepta, setAcepta] = useState(false);
  const s = useSolicitud('credito');
  const precio = Number(valor.replace(/\D/g, '')) || 0;
  const credito = datos?.tienda.credito;

  if (credito && !credito.activo) return <div className="contenedor" style={{ padding: '64px 0' }}><Vacio titulo="El crédito no está disponible en este momento" texto="Escríbenos por WhatsApp y te contamos las opciones de pago."><Enlace a="/catalogo" className="boton boton--claro">Ver catálogo</Enlace></Vacio></div>;
  return (
    <div className="contenedor" style={{ paddingBottom: 96 }}>
      <section className="portada-servicio">
        <div>
          <h1 className="titulo-1">Estrénalo hoy, págalo a cuotas</h1>
          <p className="entrada">Crédito directo de la tienda. Pagas una cuota inicial{credito ? ` desde el ${credito.cuota_inicial_min_pct} %` : ''} y el resto en cuotas fijas. Un asesor revisa tu solicitud y te explica los requisitos.</p>
        </div>
      </section>
      <div className="dos-columnas">
        <div className="pila">
          <label className="campo"><span>Valor del producto</span><input inputMode="numeric" value={valor ? pesos(precio) : ''} onChange={(e) => setValor(e.target.value)} placeholder="$ 0" /><small>{producto ? `Precio de ${producto.nombre}. Puedes cambiarlo.` : 'Escribe el valor o elige un producto del catálogo.'}</small></label>
          {credito && precio > 0 ? <SimuladorCuotas precio={precio} credito={credito} alCambiar={guardar} /> : <div className="aviso">Escribe un valor para ver tus cuotas.</div>}
        </div>
        {s.estado === 'enviada' ? (
          <div className="formulario formulario__enviada" role="status"><img src="/marca/astro.webp" alt="" /><h2 className="titulo-2">Solicitud enviada</h2><p className="secundario">Un asesor te contacta por WhatsApp para revisar tu crédito.</p></div>
        ) : (
          <form className="formulario" onSubmit={(e) => { e.preventDefault(); void s.mandar(c, { producto_id: producto?.id ?? null, datos: { Producto: producto?.nombre || '', Valor: pesos(precio), Cuotas: cuotas ? String(cuotas) : '', 'Ocupación': ocupacion } }, acepta); }}>
            <h2 className="titulo-3">Solicita tu crédito</h2>
            <div className="rejilla-campos">
              <CamposContacto valor={c} cambiar={setC} />
              <Campo etiqueta="¿A qué te dedicas? (opcional)" value={ocupacion} onChange={(e) => setOcupacion(e.target.value)} placeholder="Empleado, independiente…" ancho />
            </div>
            <Autorizacion marcado={acepta} cambiar={setAcepta} />
            {s.error && <div className="aviso aviso--error" role="alert">{s.error}</div>}
            <button type="submit" className="boton boton--primario boton--grande" disabled={s.estado === 'enviando'}>{s.estado === 'enviando' ? 'Enviando…' : 'Solicitar crédito'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
