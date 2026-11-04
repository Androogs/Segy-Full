// Textos legales base de la tienda. Usan los datos del negocio que se editan en el panel (Configuración › Negocio).
// IMPORTANTE: son una plantilla de partida. Haz que un abogado los revise y ajuste antes de publicar la tienda.
import type { Negocio } from '../lib/tipos';

export interface DocumentoLegal { titulo: string; resumen: string; secciones: { titulo: string; parrafos: string[]; lista?: string[] }[] }

export function documentos(n: Negocio | null): Record<string, DocumentoLegal> {
  const nombre = n?.nombre || 'SEGY';
  const nit = n?.nit ? `, identificado con NIT ${n.nit}` : '';
  const dir = n?.direccion ? `${n.direccion}${n.ciudad ? `, ${n.ciudad}` : ''}` : 'la dirección publicada en la página';
  const contacto = n?.telefono ? `el teléfono o WhatsApp ${n.telefono}` : 'los canales publicados en la página';
  return {
    terminos: {
      titulo: 'Términos y condiciones de compra',
      resumen: `Condiciones para comprar en la tienda en línea de ${nombre}.`,
      secciones: [
        { titulo: 'Quiénes somos', parrafos: [`${nombre}${nit}, con domicilio en ${dir}, vende celulares, accesorios y repuestos, y presta servicio técnico. Puedes contactarnos por ${contacto}.`] },
        { titulo: 'Cómo funciona un pedido', parrafos: ['Al enviar un pedido en la página no se realiza ningún cobro. Un asesor te contacta para confirmar disponibilidad, precio final, forma de entrega y pago. El pedido queda en firme cuando lo confirmamos contigo.', 'Los precios incluyen IVA cuando aplica y pueden cambiar sin previo aviso; siempre se respeta el precio confirmado en tu pedido.'] },
        { titulo: 'Crédito SEGY', parrafos: ['Las cuotas que muestra la página son una simulación referencial. El crédito está sujeto a estudio y aprobación; el plan, la cuota inicial y los intereses definitivos se informan por escrito antes de la entrega.'] },
        { titulo: 'Retoma de celulares', parrafos: ['El valor de un celular recibido como parte de pago se define después de la inspección en la tienda. Solo recibimos equipos de procedencia lícita, sin reporte de pérdida o robo y desvinculados de cuentas.'] },
        { titulo: 'Derecho de retracto', parrafos: ['En las compras a distancia puedes retractarte dentro de los cinco (5) días hábiles siguientes a la entrega, conforme al artículo 47 de la Ley 1480 de 2011. El producto debe devolverse en las mismas condiciones en que lo recibiste. El retracto no aplica a productos que por su naturaleza no puedan devolverse o se deterioren con el uso.'] },
      ],
    },
    privacidad: {
      titulo: 'Política de tratamiento de datos personales',
      resumen: 'Cómo usamos y protegemos tus datos (Ley 1581 de 2012 y Decreto 1377 de 2013).',
      secciones: [
        { titulo: 'Responsable', parrafos: [`${nombre}${nit}, con domicilio en ${dir}. Contacto para temas de datos: ${contacto}.`] },
        { titulo: 'Qué datos recogemos', parrafos: ['Nombre, celular, correo, cédula (solo si la das), dirección de entrega, los datos del equipo que quieres entregar en retoma y la información de navegación anónima de la página (páginas visitadas y campaña de origen).'] },
        { titulo: 'Para qué los usamos', parrafos: ['Atender tus pedidos y solicitudes, contactarte por WhatsApp, llamada o correo, gestionar crédito y garantías, emitir facturas y medir qué campañas nos traen clientes. No vendemos tus datos.'] },
        { titulo: 'Tus derechos', parrafos: ['Puedes conocer, actualizar, rectificar y pedir la supresión de tus datos, y revocar la autorización, escribiéndonos por los canales de contacto. Respondemos en los plazos de ley.'] },
        { titulo: 'Seguridad', parrafos: ['Los datos se guardan en sistemas con acceso restringido al personal autorizado. La navegación anónima se identifica con un código aleatorio guardado en tu navegador durante 30 días, sin cookies de terceros.'] },
      ],
    },
    garantia: {
      titulo: 'Garantía',
      resumen: 'Qué cubre la garantía de los productos que vendemos.',
      secciones: [
        { titulo: 'Garantía legal', parrafos: ['Todos los productos tienen la garantía legal de calidad e idoneidad del Estatuto del Consumidor (Ley 1480 de 2011). Los equipos nuevos tienen además la garantía del fabricante.'] },
        { titulo: 'Usados certificados y servicio técnico', parrafos: ['Los usados certificados y las reparaciones tienen el término de garantía que se indica en tu factura o comprobante.'] },
        { titulo: 'Qué no cubre', parrafos: ['Daños por golpes, humedad, manipulación por terceros o uso indebido.'] },
        { titulo: 'Cómo hacerla efectiva', parrafos: [`Trae el producto con tu factura o comprobante a ${dir}, o escríbenos por ${contacto}.`] },
      ],
    },
    envios: {
      titulo: 'Envíos y devoluciones',
      resumen: 'Formas de entrega, tiempos y devoluciones.',
      secciones: [
        { titulo: 'Entregas', parrafos: ['Puedes recoger tu pedido en la tienda, pedir domicilio en la ciudad o envío a otra ciudad por transportadora. El valor y el tiempo de entrega se confirman al validar el pedido.'] },
        { titulo: 'Recepción', parrafos: ['Revisa el paquete al recibirlo. Si llega abierto o con daños, déjalo anotado con la transportadora y escríbenos el mismo día.'] },
        { titulo: 'Devoluciones', parrafos: ['Aplican el derecho de retracto y la garantía legal descritos en los términos y condiciones.'] },
      ],
    },
  };
}
