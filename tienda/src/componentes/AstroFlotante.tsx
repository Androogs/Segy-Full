// Acceso rápido a WhatsApp con Astro, la mascota de SEGY. Se oculta en el pago para no distraer.
import { useNegocio } from '../lib/negocio';
import { useRuta } from '../lib/ruta';
import { enlaceWhatsApp } from '../lib/whatsapp';
import { registrarContacto } from '../lib/seguimiento';

export function AstroFlotante() {
  const { datos } = useNegocio();
  const { camino } = useRuta();
  const wa = datos?.negocio.whatsapp;
  if (!wa || camino === '/pagar') return null;
  const mensaje = 'Hola SEGY, tengo una pregunta.';
  return (
    <a className="astro-flotante" href={enlaceWhatsApp(wa, mensaje)} target="_blank" rel="noopener" onClick={() => registrarContacto('whatsapp', mensaje)} aria-label="Escríbenos por WhatsApp">
      <img src="/marca/astro.webp" alt="" width="44" height="44" />
      <span>¿Dudas? Escríbenos</span>
    </a>
  );
}
