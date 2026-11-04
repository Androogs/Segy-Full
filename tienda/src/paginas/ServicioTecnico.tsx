// Servicio técnico: qué reparamos, repuestos publicados (grupo "repuestos" del inventario) y solicitud de diagnóstico.
import { useState } from 'react';
import { obtener, qs } from '../lib/api';
import { usePagina } from '../lib/seo';
import { usarDatos } from '../lib/usarDatos';
import type { ListaProductos } from '../lib/tipos';
import { TarjetaProducto } from '../componentes/TarjetaProducto';
import { Autorizacion, Campo, CamposContacto, Seleccion, Texto, contactoVacio, useSolicitud } from '../componentes/Formulario';
import { SERVICIOS_TECNICOS } from '../contenido/servicios';

export function ServicioTecnico() {
  usePagina('Servicio técnico', 'Cambio de pantalla, batería y pin de carga. Diagnóstico y repuestos en la tienda.');
  const { datos } = usarDatos<ListaProductos>(() => obtener<ListaProductos>(`/productos${qs({ grupo: 'repuestos', limite: 8 })}`), []);
  const [eq, setEq] = useState({ marca: '', modelo: '', falla: SERVICIOS_TECNICOS[0].titulo });
  const [detalle, setDetalle] = useState('');
  const [c, setC] = useState(contactoVacio);
  const [acepta, setAcepta] = useState(false);
  const s = useSolicitud('servicio');
  return (
    <div className="contenedor" style={{ paddingBottom: 96 }}>
      <section className="portada-servicio"><div><h1 className="titulo-1">Lo reparamos en la tienda</h1><p className="entrada">Te decimos qué tiene tu celular, cuánto cuesta y cuánto tarda antes de empezar.</p></div></section>
      <div className="grados" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 56 }}>
        {SERVICIOS_TECNICOS.map((x) => <div key={x.titulo} className="grado"><h3 style={{ fontSize: 'var(--t-3)' }}>{x.titulo}</h3><p>{x.texto}</p></div>)}
      </div>
      <div className="dos-columnas">
        {s.estado === 'enviada' ? (
          <div className="formulario formulario__enviada" role="status"><img src="/marca/astro.webp" alt="" /><h2 className="titulo-2">Recibimos tu solicitud</h2><p className="secundario">Te escribimos por WhatsApp para agendar la revisión.</p></div>
        ) : (
          <form className="formulario" onSubmit={(e) => { e.preventDefault(); void s.mandar(c, { mensaje: detalle, datos: { Marca: eq.marca, Modelo: eq.modelo, Servicio: eq.falla } }, acepta); }}>
            <h2 className="titulo-3">Pide tu diagnóstico</h2>
            <div className="rejilla-campos">
              <Campo etiqueta="Marca" required value={eq.marca} onChange={(e) => setEq({ ...eq, marca: e.target.value })} />
              <Campo etiqueta="Modelo" required value={eq.modelo} onChange={(e) => setEq({ ...eq, modelo: e.target.value })} />
              <Seleccion etiqueta="¿Qué necesitas?" value={eq.falla} onChange={(e) => setEq({ ...eq, falla: e.target.value })} ancho>{SERVICIOS_TECNICOS.map((x) => <option key={x.titulo}>{x.titulo}</option>)}</Seleccion>
              <Texto etiqueta="Cuéntanos qué pasa" rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)} ancho />
              <CamposContacto valor={c} cambiar={setC} />
            </div>
            <Autorizacion marcado={acepta} cambiar={setAcepta} />
            {s.error && <div className="aviso aviso--error" role="alert">{s.error}</div>}
            <button type="submit" className="boton boton--primario boton--grande" disabled={s.estado === 'enviando'}>{s.estado === 'enviando' ? 'Enviando…' : 'Pedir diagnóstico'}</button>
          </form>
        )}
        <aside className="pila">
          <h2 className="titulo-3">Repuestos disponibles</h2>
          {datos && datos.productos.length > 0
            ? <div className="rejilla-productos" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>{datos.productos.slice(0, 4).map((p) => <TarjetaProducto key={p.id} producto={p} />)}</div>
            : <p className="secundario">Pregúntanos por el repuesto de tu equipo: lo conseguimos por encargo.</p>}
        </aside>
      </div>
    </div>
  );
}
