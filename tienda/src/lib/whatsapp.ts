// Enlaces de WhatsApp con mensaje prellenado.
export const enlaceWhatsApp = (numero: string, mensaje: string): string =>
  numero ? `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}` : '';
export const enlaceTelefono = (tel: string): string => `tel:+${tel.replace(/\D/g, '').replace(/^(3\d{9})$/, '57$1')}`;
