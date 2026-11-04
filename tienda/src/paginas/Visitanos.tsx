// Visítanos: dirección, horario, contacto y formulario general.
import { useState } from 'react';
import { useNegocio } from '../lib/negocio';
import { usePagina } from '../lib/seo';
import { enlaceTelefono, enlaceWhatsApp } from '../lib/whatsapp';
import { registrarContacto } from '../lib/seguimiento';
import { Autorizacion, CamposContacto, Texto, contactoVacio, useSolicitud } from '../componentes/Formulario';
import { Icono } from '../componentes/Icono';

export function Visitanos() {
  const { datos } = useNegocio();
  const n = datos?.negocio;
  usePagina('Visítanos', n ? `SEGY en ${n.direccion}, ${n.ciudad}.` : null);
  const [c, setC] = useState(contactoVacio);
  const [mensaje, setMensaje] = useState('');
  const [acepta, setAcepta] = useState(false);
  const s = useSolicitud('contacto');
  const mapa = n?.mapa_url || (n?.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${n.nombre} ${n.direccion} ${n.ciudad}`)}` : '');
  return (
    <div className="contenedor" style={{ paddingBottom: 96 }}>
      <section className="portada-servicio"><div><h1 className="titulo-1">Ven a la tienda</h1><p className="entrada">Prueba los equipos, trae tu celular para la retoma o para revisión y llévate todo configurado.</p></div></section>
      <div className="dos-columnas">
        <div className="franja" style={{ gridTemplateColumns: '1fr' }}>
          <dl>
            {n?.direccion && <div><dt>Dirección</dt><dd>{n.direccion}{n.ciudad ? `, ${n.ciudad}` : ''}</dd></div>}
            <div><dt>Horario</dt><dd>{n?.horario || 'Escríbenos para confirmar el horario de hoy'}</dd></div>
            {n?.telefono && <div><dt>Teléfono</dt><dd><a className="enlace" href={enlaceTelefono(n.telefono)} onClick={() => registrarContacto('telefono', n.telefono)}>{n.telefono}</a></dd></div>}
          </dl>
          <div className="fila">
            {mapa && <a className="boton boton--claro" href={mapa} target="_blank" rel="noopener"><Icono nombre="ubicacion" />Abrir en el mapa</a>}
            {n?.whatsapp && <a className="boton boton--contorno" href={enlaceWhatsApp(n.whatsapp, 'Hola SEGY, quiero ir a la tienda.')} target="_blank" rel="noopener" onClick={() => registrarContacto('whatsapp', 'Visita a la tienda')}><Icono nombre="mensaje" />WhatsApp</a>}
          </div>
        </div>
        {s.estado === 'enviada' ? (
          <div className="formulario formulario__enviada" role="status"><img src="/marca/astro.webp" alt="" /><h2 className="titulo-2">Mensaje enviado</h2><p className="secundario">Te respondemos pronto por WhatsApp.</p></div>
        ) : (
          <form className="formulario" onSubmit={(e) => { e.preventDefault(); void s.mandar(c, { mensaje }, acepta); }}>
            <h2 className="titulo-3">Escríbenos</h2>
            <div className="rejilla-campos"><CamposContacto valor={c} cambiar={setC} /><Texto etiqueta="Mensaje" rows={4} required value={mensaje} onChange={(e) => setMensaje(e.target.value)} ancho /></div>
            <Autorizacion marcado={acepta} cambiar={setAcepta} />
            {s.error && <div className="aviso aviso--error" role="alert">{s.error}</div>}
            <button type="submit" className="boton boton--primario boton--grande" disabled={s.estado === 'enviando'}>{s.estado === 'enviando' ? 'Enviando…' : 'Enviar mensaje'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
