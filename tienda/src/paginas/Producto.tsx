// Ficha de producto: galería (fotos del panel o ilustración), precio y cuotas, disponibilidad real, atributos,
// compra, retoma, WhatsApp y accesorios compatibles. Si está agotado, permite pedir aviso de disponibilidad.
import { useCallback, useEffect, useState } from 'react';
import { obtener } from '../lib/api';
import { useCarrito } from '../lib/carrito';
import { useNegocio } from '../lib/negocio';
import { cuotaDesde, pesos } from '../lib/formato';
import { Enlace, navegar, useRuta } from '../lib/ruta';
import { usePagina } from '../lib/seo';
import { registrarContacto, registrarProducto } from '../lib/seguimiento';
import { enlaceWhatsApp } from '../lib/whatsapp';
import { usarDatos } from '../lib/usarDatos';
import type { ProductoDetalle } from '../lib/tipos';
import { VisualProducto } from '../componentes/VisualProducto';
import { TarjetaProducto, textoDisponibilidad } from '../componentes/TarjetaProducto';
import { Cantidad } from '../componentes/CarritoLateral';
import { SimuladorCuotas } from '../componentes/SimuladorCuotas';
import { Icono } from '../componentes/Icono';
import { ErrorCarga } from '../componentes/Estados';
import { Autorizacion, CamposContacto, contactoVacio, useSolicitud } from '../componentes/Formulario';
import { GRADOS } from '../contenido/servicios';
import { NoEncontrada } from './NoEncontrada';

function AvisoDisponibilidad({ producto }: { producto: ProductoDetalle }) {
  const [c, setC] = useState(contactoVacio);
  const [acepta, setAcepta] = useState(false);
  const s = useSolicitud('aviso_stock');
  if (s.estado === 'enviada') return <div className="aviso aviso--ok">Listo. Te escribimos apenas llegue el {producto.nombre}.</div>;
  return (
    <form className="formulario" onSubmit={(e) => { e.preventDefault(); void s.mandar(c, { producto_id: producto.id, mensaje: 'Quiere que le avisen cuando haya disponibilidad.' }, acepta); }}>
      <div><h2 className="titulo-3">Avísame cuando llegue</h2><p className="chico secundario">Te escribimos por WhatsApp apenas tengamos unidades.</p></div>
      <div className="rejilla-campos"><CamposContacto valor={c} cambiar={setC} /></div>
      <Autorizacion marcado={acepta} cambiar={setAcepta} />
      {s.error && <div className="aviso aviso--error" role="alert">{s.error}</div>}
      <button type="submit" className="boton boton--claro" disabled={s.estado === 'enviando'}>{s.estado === 'enviando' ? 'Enviando…' : 'Avisarme'}</button>
    </form>
  );
}

export function Producto() {
  const { partes } = useRuta();
  const slug = partes[1] || '';
  const { datos: negocio } = useNegocio();
  const { agregar } = useCarrito();
  const { datos: p, cargando, error, status, reintentar } = usarDatos<ProductoDetalle>(slug ? () => obtener<ProductoDetalle>(`/productos/${encodeURIComponent(slug)}`) : null, [slug]);
  const [foto, setFoto] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const [verSimulador, setVerSimulador] = useState(false);
  useEffect(() => { setFoto(0); setCantidad(1); setVerSimulador(false); }, [slug]);
  useEffect(() => { if (p) registrarProducto(p.nombre, p.id); }, [p]);
  usePagina(p ? p.nombre : cargando ? null : 'Producto', p ? `${p.nombre} a ${pesos(p.precio)} en SEGY. ${p.resumen || p.categoria?.nombre || ''}`.trim() : null);
  const noop = useCallback(() => undefined, []);

  if (status === 404) return <NoEncontrada titulo="Este producto ya no está en la tienda" texto="Puede que se haya agotado o cambiado de nombre. Busca uno parecido en el catálogo." />;
  if (error) return <ErrorCarga mensaje={error} reintentar={reintentar} />;
  if (!p) return <div className="contenedor" style={{ padding: '48px 0' }}><div className="ficha-producto"><div className="esqueleto" style={{ aspectRatio: '1', borderRadius: 24 }} /><div className="pila"><div className="esqueleto" style={{ height: 18, width: '30%' }} /><div className="esqueleto" style={{ height: 48, width: '90%' }} /><div className="esqueleto" style={{ height: 36, width: '40%' }} /></div></div></div>;

  const credito = negocio?.tienda.credito;
  const financiable = (p.grupo === 'celulares' || p.grupo === 'usados') && credito?.activo;
  const cuota = financiable && credito ? cuotaDesde(p.precio, credito.planes, credito.cuota_inicial_min_pct) : null;
  const wa = negocio?.negocio.whatsapp || '';
  const mensajeWa = `Hola SEGY, me interesa el ${p.nombre} (${pesos(p.precio)}). ¿Me ayudan?`;
  const fotos = p.fotos.length ? p.fotos : [null];
  const disp = textoDisponibilidad(p);
  const grado = p.grado ? GRADOS.find((g) => g.letra === p.grado) : null;
  const max = Math.max(1, Math.min(10, p.disponibles));
  const grupoNombre = negocio?.grupos.find((g) => g.clave === p.grupo)?.nombre || p.grupo;

  return (
    <div className="contenedor">
      <nav aria-label="Ruta"><ol className="migas"><li><Enlace a="/">Inicio</Enlace></li><li><Enlace a={`/catalogo/${p.grupo}`}>{grupoNombre}</Enlace></li>{p.categoria && <li><Enlace a={`/catalogo/${p.grupo}?categoria=${p.categoria.id}`}>{p.categoria.nombre}</Enlace></li>}</ol></nav>
      <div className="ficha-producto">
        <div className="galeria">
          <div className="galeria__principal"><VisualProducto producto={p} foto={fotos[foto]} /></div>
          {fotos.length > 1 && (
            <div className="galeria__miniaturas">
              {fotos.map((f, i) => <button key={f || i} type="button" aria-pressed={i === foto} onClick={() => setFoto(i)} aria-label={`Ver foto ${i + 1}`}><VisualProducto producto={p} foto={f} /></button>)}
            </div>
          )}
        </div>
        <div className="info">
          {p.marca && p.marca !== 'Genérico' && <span className="info__marca">{p.marca}</span>}
          <h1>{p.nombre}</h1>
          {p.resumen && <p className="entrada">{p.resumen}</p>}
          <div className="info__precio"><span className="precio">{pesos(p.precio)}</span>{p.precio_antes && <><span className="antes">{pesos(p.precio_antes)}</span><span className="insignia insignia--rojo">Ahorras {pesos(p.precio_antes - p.precio)}</span></>}</div>
          {cuota && <p className="secundario">o {cuota.cuotas} cuotas de <strong style={{ color: 'var(--tiza)' }}>{pesos(cuota.cuota)}</strong> con crédito SEGY. <button type="button" className="enlace" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setVerSimulador((v) => !v)}>{verSimulador ? 'Ocultar simulador' : 'Calcular mis cuotas'}</button></p>}
          {verSimulador && credito && <SimuladorCuotas precio={p.precio} credito={credito} alCambiar={noop} />}
          {grado && <div className="grado-detalle"><b>{grado.letra}</b><div><strong>Grado {grado.letra}: {grado.nombre}</strong><p className="chico secundario">{grado.texto} Revisado con la inspección completa de SEGY.</p></div></div>}
          <p className="disponibilidad"><i className={`punto ${disp.clase}`} />{p.disponible ? (p.ultimas_unidades ? `Últimas unidades en la tienda` : 'Disponible en la tienda') : 'Agotado por ahora'}</p>

          <dl className="info__atributos">
            {p.capacidad && <><dt>Capacidad</dt><dd>{p.capacidad}</dd></>}
            {p.color && <><dt>Color</dt><dd>{p.color}</dd></>}
            {p.modelo_compatible && <><dt>Compatible con</dt><dd>{p.modelo_compatible}</dd></>}
            {p.categoria && <><dt>Categoría</dt><dd>{p.categoria.nombre}</dd></>}
            {p.referencia && <><dt>Referencia</dt><dd>{p.referencia}</dd></>}
          </dl>

          {p.disponible ? (
            <div className="info__comprar">
              <Cantidad valor={cantidad} max={max} cambiar={(n) => setCantidad(Math.max(1, Math.min(max, n)))} nombre={p.nombre} />
              <button type="button" className="boton boton--primario boton--grande" onClick={() => agregar(p, cantidad)}><Icono nombre="bolsa" />Agregar al carrito</button>
              <button type="button" className="boton boton--claro boton--grande" onClick={() => { agregar(p, cantidad); navegar('/pagar'); }}>Comprar ahora</button>
            </div>
          ) : <AvisoDisponibilidad producto={p} />}

          <ul className="beneficios">
            <li><Icono nombre="escudo" /><span>Garantía en la tienda según el tipo de producto. <Enlace a="/legal/garantia" className="enlace">Ver condiciones</Enlace></span></li>
            <li><Icono nombre="camion" /><span>Recógelo en la tienda o recíbelo a domicilio{negocio?.tienda.envio.nacional ? '; también enviamos a todo el país' : ''}.</span></li>
            {(p.grupo === 'celulares' || p.grupo === 'usados') && <li><Icono nombre="retoma" /><span>Entrega tu celular como parte de pago. <Enlace a={`/retoma?producto=${p.id}`} className="enlace">Cotizar mi celular</Enlace></span></li>}
            {wa && <li><Icono nombre="mensaje" /><span>¿Dudas? <a className="enlace" href={enlaceWhatsApp(wa, mensajeWa)} target="_blank" rel="noopener" onClick={() => registrarContacto('whatsapp', mensajeWa, p.nombre)}>Pregúntanos por WhatsApp</a></span></li>}
          </ul>
          {p.descripcion && <div><h2 className="titulo-3" style={{ marginBottom: 10 }}>Descripción</h2><p className="descripcion">{p.descripcion}</p></div>}
        </div>
      </div>

      {p.compatibles.length > 0 && (
        <section className="seccion" aria-labelledby="t-comp">
          <div className="seccion__cab"><h2 id="t-comp" className="titulo-2">Complétalo con</h2></div>
          <div className="carril">{p.compatibles.map((x) => <TarjetaProducto key={x.id} producto={x} />)}</div>
        </section>
      )}
      {p.relacionados.length > 0 && (
        <section className="seccion" aria-labelledby="t-rel">
          <div className="seccion__cab"><h2 id="t-rel" className="titulo-2">También te puede interesar</h2><Enlace a={`/catalogo/${p.grupo}`} className="boton boton--contorno">Ver {grupoNombre.toLowerCase()}</Enlace></div>
          <div className="carril">{p.relacionados.map((x) => <TarjetaProducto key={x.id} producto={x} />)}</div>
        </section>
      )}
    </div>
  );
}
