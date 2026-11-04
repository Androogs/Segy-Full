// Piezas de formulario: campo con etiqueta, autorización de datos (Ley 1581 de 2012) y envío de solicitudes al panel.
import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { enviar, ErrorApi } from '../lib/api';
import { origen } from '../lib/seguimiento';
import { Enlace } from '../lib/ruta';
import type { TipoSolicitud } from '../lib/tipos';

export function Campo({ etiqueta, ayuda, ancho, ...props }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; ancho?: boolean }) {
  return <label className={`campo${ancho ? ' ancho' : ''}`}><span>{etiqueta}</span><input {...props} />{ayuda && <small>{ayuda}</small>}</label>;
}
export function Seleccion({ etiqueta, children, ancho, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; ancho?: boolean; children: ReactNode }) {
  return <label className={`campo${ancho ? ' ancho' : ''}`}><span>{etiqueta}</span><select {...props}>{children}</select></label>;
}
export function Texto({ etiqueta, ancho, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string; ancho?: boolean }) {
  return <label className={`campo${ancho ? ' ancho' : ''}`}><span>{etiqueta}</span><textarea {...props} /></label>;
}

export function Autorizacion({ marcado, cambiar }: { marcado: boolean; cambiar: (v: boolean) => void }) {
  return (
    <label className="casilla">
      <input type="checkbox" checked={marcado} onChange={(e) => cambiar(e.target.checked)} required />
      <span>Autorizo a SEGY a usar mis datos para atender esta solicitud y contactarme por WhatsApp, llamada o correo, según la <Enlace a="/legal/privacidad" className="enlace" target="_blank">política de tratamiento de datos</Enlace>.</span>
    </label>
  );
}

export interface DatosContacto { nombre: string; telefono: string; email: string }
export const contactoVacio: DatosContacto = { nombre: '', telefono: '', email: '' };

// Envío de una solicitud (retoma, crédito, servicio, contacto, aviso de disponibilidad) → cliente potencial en Marketing.
export function useSolicitud(tipo: TipoSolicitud) {
  const [estado, setEstado] = useState<'libre' | 'enviando' | 'enviada'>('libre');
  const [error, setError] = useState<string | null>(null);
  async function mandar(contacto: DatosContacto, extra: { mensaje?: string; datos?: Record<string, string>; producto_id?: number | null; producto_texto?: string }, acepta: boolean) {
    setError(null);
    if (!acepta) { setError('Marca la autorización de datos para poder responderte.'); return false; }
    setEstado('enviando');
    try {
      await enviar('/solicitudes', { tipo, acepta_datos: true, ...contacto, ...extra, ...origen() });
      setEstado('enviada');
      return true;
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos enviar tu solicitud. Inténtalo de nuevo.');
      setEstado('libre');
      return false;
    }
  }
  return { estado, error, mandar, reiniciar: () => { setEstado('libre'); setError(null); } };
}

export function CamposContacto({ valor, cambiar }: { valor: DatosContacto; cambiar: (v: DatosContacto) => void }) {
  return (
    <>
      <Campo etiqueta="Nombre completo" name="nombre" autoComplete="name" required value={valor.nombre} onChange={(e) => cambiar({ ...valor, nombre: e.target.value })} ancho />
      <Campo etiqueta="Celular o WhatsApp" name="telefono" type="tel" inputMode="tel" autoComplete="tel" required placeholder="300 123 4567" value={valor.telefono} onChange={(e) => cambiar({ ...valor, telefono: e.target.value })} />
      <Campo etiqueta="Correo (opcional)" name="email" type="email" autoComplete="email" value={valor.email} onChange={(e) => cambiar({ ...valor, email: e.target.value })} />
    </>
  );
}
