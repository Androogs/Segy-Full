// Retoma: el cliente describe su celular y SEGY le responde con una oferta tras la inspección (módulo Usados del panel).
import { useState } from 'react';
import { obtener } from '../lib/api';
import { useRuta, Enlace } from '../lib/ruta';
import { usePagina } from '../lib/seo';
import { usarDatos } from '../lib/usarDatos';
import type { ProductoDetalle } from '../lib/tipos';
import { Autorizacion, Campo, CamposContacto, Seleccion, Texto, contactoVacio, useSolicitud } from '../componentes/Formulario';
import { GRADOS, INSPECCION } from '../contenido/servicios';

export function Retoma() {
  usePagina('Retoma: tu celular como parte de pago', 'Recibimos tu celular como parte de pago. Lo revisamos en la tienda y te damos una oferta clara.');
  const { query } = useRuta();
  const productoId = query.get('producto');
  const { datos: interes } = usarDatos<ProductoDetalle>(productoId ? () => obtener<ProductoDetalle>(`/productos/${productoId}`) : null, [productoId]);
  const [eq, setEq] = useState({ marca: '', modelo: '', capacidad: '', bateria: '', pantalla: 'Perfecta', funciona: 'Todo funciona', accesorios: '' });
  const [c, setC] = useState(contactoVacio);
  const [mensaje, setMensaje] = useState('');
  const [acepta, setAcepta] = useState(false);
  const s = useSolicitud('retoma');
  const enviarForm = (e: React.FormEvent) => {
    e.preventDefault();
    void s.mandar(c, {
      mensaje,
      producto_id: interes?.id ?? null,
      datos: { Marca: eq.marca, Modelo: eq.modelo, Capacidad: eq.capacidad, 'Batería': eq.bateria ? `${eq.bateria} %` : '', Pantalla: eq.pantalla, Funcionamiento: eq.funciona, Accesorios: eq.accesorios, 'Quiere comprar': interes?.nombre || '' },
    }, acepta);
  };
  return (
    <div className="contenedor" style={{ paddingBottom: 96 }}>
      <section className="portada-servicio">
        <div>
          <h1 className="titulo-1">Tu celular vale como parte de pago</h1>
          <p className="entrada">Cuéntanos qué equipo tienes. Lo revisamos en la tienda con la misma inspección de nuestros usados certificados y te damos una oferta clara para descontarla de tu compra.</p>
        </div>
        <img src="/marca/astro.webp" alt="Astro, la mascota de SEGY" />
      </section>
      <ol className="pasos" style={{ marginBottom: 56 }}>
        <li><h3>Cuéntanos de tu equipo</h3><p>Marca, modelo, capacidad y cómo está. Te respondemos por WhatsApp con un estimado.</p></li>
        <li><h3>Lo revisamos contigo</h3><p>{INSPECCION.join('. ')}.</p></li>
        <li><h3>Recibe tu oferta</h3><p>Si te sirve, la descontamos de tu nuevo celular o accesorios en el mismo momento.</p></li>
      </ol>
      <div className="dos-columnas">
        {s.estado === 'enviada' ? (
          <div className="formulario formulario__enviada" role="status"><img src="/marca/astro.webp" alt="" /><h2 className="titulo-2">¡Listo, {c.nombre.split(' ')[0]}!</h2><p className="secundario">Recibimos los datos de tu {eq.marca} {eq.modelo}. Te escribimos por WhatsApp con el estimado.</p><Enlace a="/catalogo/celulares" className="boton boton--claro">Mientras tanto, mira los celulares</Enlace></div>
        ) : (
          <form className="formulario" onSubmit={enviarForm}>
            <h2 className="titulo-3">Tu equipo</h2>
            {interes && <div className="aviso">Lo usarás como parte de pago de: <strong>{interes.nombre}</strong></div>}
            <div className="rejilla-campos">
              <Seleccion etiqueta="Marca" required value={eq.marca} onChange={(e) => setEq({ ...eq, marca: e.target.value })}><option value="">Elige la marca</option>{['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Huawei', 'Honor', 'Oppo', 'Otra'].map((m) => <option key={m}>{m}</option>)}</Seleccion>
              <Campo etiqueta="Modelo" required value={eq.modelo} onChange={(e) => setEq({ ...eq, modelo: e.target.value })} placeholder="iPhone 13, Galaxy S22…" />
              <Campo etiqueta="Capacidad" value={eq.capacidad} onChange={(e) => setEq({ ...eq, capacidad: e.target.value })} placeholder="128 GB" />
              <Campo etiqueta="Salud de la batería (%)" type="number" min={0} max={100} inputMode="numeric" value={eq.bateria} onChange={(e) => setEq({ ...eq, bateria: e.target.value })} ayuda="En iPhone: Ajustes › Batería › Estado." />
              <Seleccion etiqueta="Pantalla" value={eq.pantalla} onChange={(e) => setEq({ ...eq, pantalla: e.target.value })}>{['Perfecta', 'Rayones leves', 'Rayones visibles', 'Rota o con manchas'].map((o) => <option key={o}>{o}</option>)}</Seleccion>
              <Seleccion etiqueta="Funcionamiento" value={eq.funciona} onChange={(e) => setEq({ ...eq, funciona: e.target.value })}>{['Todo funciona', 'Falla algo (cuéntanos abajo)', 'No enciende'].map((o) => <option key={o}>{o}</option>)}</Seleccion>
              <Campo etiqueta="Accesorios que incluye" value={eq.accesorios} onChange={(e) => setEq({ ...eq, accesorios: e.target.value })} placeholder="Caja, cable, factura…" ancho />
              <Texto etiqueta="Algo más que debamos saber (opcional)" rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} ancho />
            </div>
            <h2 className="titulo-3">Tus datos</h2>
            <div className="rejilla-campos"><CamposContacto valor={c} cambiar={setC} /></div>
            <Autorizacion marcado={acepta} cambiar={setAcepta} />
            {s.error && <div className="aviso aviso--error" role="alert">{s.error}</div>}
            <button type="submit" className="boton boton--primario boton--grande" disabled={s.estado === 'enviando'}>{s.estado === 'enviando' ? 'Enviando…' : 'Quiero mi estimado'}</button>
            <p className="chico terciario">El valor final depende de la revisión del equipo en la tienda. Recibimos equipos sin reporte de pérdida o robo y desvinculados de cuentas.</p>
          </form>
        )}
        <aside className="pila">
          <h2 className="titulo-3">Así clasificamos los equipos</h2>
          <div className="grados" style={{ gridTemplateColumns: '1fr' }}>{GRADOS.map((g) => <div key={g.letra} className="grado"><b>{g.letra}</b><h3>{g.nombre}</h3><p>{g.texto}</p></div>)}</div>
        </aside>
      </div>
    </div>
  );
}
