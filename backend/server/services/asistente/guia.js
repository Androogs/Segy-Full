'use strict';
// Guía de uso que el asistente Astro entrega con la herramienta `guia_de_uso`. Textos en español, para personas no técnicas,
// que describen SOLO procesos que existen en la aplicación (ver public/js/ayuda.js y las vistas de cada módulo).
// Cada tema tiene palabras clave para encontrarlo aunque el usuario lo pida con otras palabras.

const TEMAS = [
  {
    clave: 'registrar_compra',
    titulo: 'Registrar una compra a un proveedor (con la TRM si es en dólares)',
    ruta: '#/compras/nueva',
    palabras: ['compra', 'compras', 'proveedor', 'factura', 'trm', 'dolar', 'dólar', 'usd', 'tasa', 'importar', 'mercancía', 'mercancia'],
    pasos: [
      'Abre Compras y toca "Nueva compra" (ruta #/compras/nueva).',
      'Elige el proveedor (o créalo desde el mismo buscador) y escribe el número de factura y la fecha.',
      'Si tienes la factura en foto o PDF, adjúntala: con la lectura automática (OCR) configurada, la app propone los productos y valores; revísalos antes de confirmar.',
      'Agrega cada producto con su cantidad y costo unitario. Los celulares con IMEI piden un serial por unidad.',
      'Si la compra es en dólares, cambia la moneda a USD: la app propone la tasa (TRM oficial del día o la de mercado) y puedes ajustarla indicando el motivo. Esa tasa convierte los costos a pesos y queda guardada en la compra como referencia histórica.',
      'Anota fletes, impuestos o descuentos generales: se reparten entre los productos para que el costo por unidad sea el real.',
      'Indica cuánto pagaste y con qué método; lo que falte queda como saldo pendiente con el proveedor.',
      'Confirma. La compra crea un lote por producto con su costo y las unidades entran al inventario.',
    ],
    consejos: ['La app avisa si una factura parece duplicada (mismo proveedor y número).', 'Para ver la TRM registrada en una compra abre la compra desde Compras, o pregúntale a Astro por la última compra.'],
  },
  {
    clave: 'hacer_venta',
    titulo: 'Hacer una venta',
    ruta: '#/vender',
    palabras: ['venta', 'vender', 'cobrar', 'carrito', 'punto de venta', 'pos', 'factura de venta', 'comprobante'],
    pasos: [
      'Abre Vender (ruta #/vender). Si vas a recibir efectivo, revisa arriba que la caja esté abierta; si no, ábrela desde ahí.',
      'Busca el producto por nombre o código, o escanéalo con la cámara, y tócalo para agregarlo al carrito. Los celulares usados de SEGY aparecen en "Celulares usados en venta" con su grado e IMEI.',
      'Ajusta cantidades con + y −; "Quitar" saca la línea del carrito.',
      'Si corresponde, aplica un descuento o cambia el precio (requiere permiso).',
      'Elige el cliente (opcional para contado, obligatorio para crédito).',
      'Toca Cobrar: elige contado, crédito o pago parcial y uno o varios métodos de pago (efectivo, transferencia, Nequi, Daviplata, tarjeta). Un celular usado también puede entrar como parte de pago.',
      'Confirma. La venta descuenta el inventario, registra el pago en caja y genera el comprobante, que puedes descargar en PDF o enviar por WhatsApp.',
    ],
    consejos: ['El carrito se guarda solo si cierras la pantalla por accidente.', 'Las devoluciones y anulaciones se hacen desde el historial de Ventas (#/ventas), siempre con un motivo.'],
  },
  {
    clave: 'cobrar_credito',
    titulo: 'Cobrar una cuota o registrar un abono a un crédito',
    ruta: '#/creditos',
    palabras: ['crédito', 'credito', 'cuota', 'abono', 'abonar', 'cartera', 'deuda', 'saldo', 'fiado', 'vencido'],
    pasos: [
      'Abre Créditos y cartera (ruta #/creditos). Filtra por Vencidos o Por vencer para ver qué hay que cobrar primero.',
      'Toca "Registrar abono" (o abre el crédito y usa el botón de abonar).',
      'Elige el crédito o el cliente, escribe el valor, el método de pago y, si quieres, la referencia del comprobante.',
      'Confirma. El abono se aplica a las cuotas más antiguas, actualiza el saldo y entra a la caja abierta.',
      'Desde la ficha del cliente puedes descargar o enviar por WhatsApp el estado de cuenta en PDF.',
    ],
    consejos: ['Los créditos nacen al cobrar una venta a crédito o con pago parcial en Vender.', 'Si el abono es en dólares, la app guarda la tasa y calcula la diferencia cambiaria en Contabilidad.'],
  },
  {
    clave: 'abrir_cerrar_caja',
    titulo: 'Abrir y cerrar la caja',
    ruta: '#/caja',
    palabras: ['caja', 'abrir caja', 'cerrar caja', 'base', 'efectivo', 'turno', 'arqueo', 'cierre', 'gasto', 'gastos'],
    pasos: [
      'Para abrir: entra a Caja y gastos (ruta #/caja) o usa el botón "Abrir caja" que aparece arriba de Vender. Escribe la base inicial en efectivo y confirma; la app guarda fecha y hora.',
      'Durante el turno: las ventas en efectivo se suman solas; registra los gastos con categoría, valor y comprobante, y las entradas o salidas de dinero con su motivo.',
      'Para pagar facturas de proveedores usa la pestaña "Por pagar".',
      'Para cerrar: toca "Cerrar caja", cuenta el efectivo y escribe el valor contado. La app muestra el efectivo esperado y registra la diferencia (sobrante o faltante) con fecha y hora.',
      'Los cierres anteriores quedan en la pestaña "Cierres" con sus diferencias.',
    ],
    consejos: ['Abre la caja al empezar el día para que el cierre cuadre.', 'Solo puede haber una caja abierta a la vez.'],
  },
  {
    clave: 'recibir_usado',
    titulo: 'Recibir un celular usado (retoma o compra a un particular)',
    ruta: '#/usados/nuevo',
    palabras: ['usado', 'usados', 'retoma', 'recibir celular', 'segunda mano', 'inspección', 'inspeccion', 'valorar', 'grado', 'imei'],
    pasos: [
      'Abre Celulares usados y toca "Recibir celular" (ruta #/usados/nuevo). Son 4 pasos y puedes dejarlo en borrador y retomarlo después.',
      'Paso 1, Identificar: IMEI, marca, modelo, capacidad, color y datos de la persona que lo entrega. Toma las fotos frontal y trasera.',
      'Paso 2, Inspeccionar: marca el estado de cada punto (pantalla, batería, funcionamiento, estado físico y seguridad: cuentas, bloqueo, reporte).',
      'Paso 3, Valorar: escribe el valor de mercado (o el precio del nuevo equivalente), reparaciones y preparación. La app calcula la oferta sugerida, el costo máximo y el grado (A, B o C); puedes ajustar la oferta final y el grado.',
      'Paso 4, Confirmar: indica si la persona aceptó, la forma de pago y envía a aprobación o aprueba (según tu permiso). Una oferta por encima del costo máximo requiere aprobación del empleador con un motivo.',
      'Al aprobarse, el equipo entra al inventario en "Celulares usados" con su costo y aparece en Vender con su grado e IMEI.',
    ],
    consejos: ['En una venta, un usado puede ser parte de pago: elige el método "Celular usado".', 'El Glosario (desde Inicio o el botón "?") explica costo máximo, reserva de riesgo y margen objetivo.'],
  },
  {
    clave: 'rentabilidad_campana',
    titulo: 'Consultar la rentabilidad de una campaña de marketing',
    ruta: '#/marketing',
    palabras: ['rentabilidad campaña', 'campaña', 'campana', 'marketing', 'anuncio', 'anuncios', 'inversión', 'inversion', 'retorno', 'roi', 'meta ads', 'publicidad'],
    pasos: [
      'Abre Marketing (ruta #/marketing). El panel resume la inversión, los clientes potenciales, las ventas atribuidas y el resultado del periodo.',
      'Elige el periodo con las pastillas de arriba (Hoy, 7 días, 30 días, Este mes, Este año o un rango).',
      'Entra al apartado de rentabilidad (o abre la campaña) para ver, por campaña: inversión, ventas atribuidas (confirmadas y estimadas), ganancia y retorno.',
      'Si la plataforma publicitaria no está conectada, la inversión y las métricas se capturan a mano desde la campaña; la pantalla indica "sin credenciales".',
    ],
    consejos: ['Una venta se atribuye a una campaña de forma confirmada cuando hay evidencia directa (campaña elegida en la venta o cliente potencial vinculado) y de forma estimada por la ventana de atribución configurada.', 'También puedes pedirle a Astro: "¿Qué campaña fue más rentable este mes?".'],
  },
  {
    clave: 'crear_campana',
    titulo: 'Crear una campaña de marketing',
    ruta: '#/marketing',
    palabras: ['crear campaña', 'nueva campaña', 'campaña', 'campana', 'utm', 'plataforma', 'instagram', 'facebook', 'tiktok', 'google'],
    pasos: [
      'Abre Marketing (ruta #/marketing) y entra al apartado de campañas.',
      'Toca "Nueva campaña": nombre, plataforma (Meta, Google, TikTok, WhatsApp, otra), objetivo, fechas de inicio y fin y presupuesto.',
      'Opcional: asocia los productos que promociona y el identificador UTM para atribuir visitas y clientes potenciales desde la web.',
      'Guarda. Luego registra la inversión y las métricas (impresiones, clics, conversaciones) a mano o deja que la sincronización las traiga si la plataforma está conectada.',
    ],
    consejos: ['Conectar Meta, Google o TikTok requiere credenciales en el servidor (Configuración › Integraciones y docs/MARKETING.md).'],
  },
  {
    clave: 'registrar_lead',
    titulo: 'Registrar un cliente potencial (lead)',
    ruta: '#/marketing',
    palabras: ['cliente potencial', 'lead', 'leads', 'prospecto', 'interesado', 'preguntó', 'pregunto', 'whatsapp', 'contacto'],
    pasos: [
      'Abre Marketing (ruta #/marketing) y entra al apartado de clientes potenciales.',
      'Toca "Nuevo cliente potencial": nombre, teléfono, canal por el que llegó (WhatsApp, Instagram, web, en el local…), producto que le interesa y, si aplica, la campaña.',
      'Guarda. A medida que lo atiendes, cambia su estado: nuevo, contactado, interesado, convertido o perdido.',
      'Cuando compre, vincúlalo a la venta o al cliente: así la venta queda atribuida a la campaña.',
    ],
    consejos: ['Los vendedores y cajeros pueden registrar y atender clientes potenciales sin ver el resto del módulo de marketing.'],
  },
  {
    clave: 'exportar_reportes',
    titulo: 'Exportar reportes a Excel o PDF',
    ruta: '#/reportes',
    palabras: ['reporte', 'reportes', 'exportar', 'excel', 'csv', 'pdf', 'informe', 'descargar'],
    pasos: [
      'Abre Reportes (ruta #/reportes) y elige el informe: inventario, ventas, compras, cartera, gastos, cierres de caja, rentabilidad, entre otros.',
      'Filtra por fechas y, donde aplique, por categoría, producto o días sin movimiento.',
      'Revisa el resumen y la gráfica en pantalla para confirmar que es el informe que necesitas.',
      'Toca "Excel" (archivo CSV que Excel abre directo) o "PDF" para descargarlo.',
    ],
    consejos: ['Si el archivo sale vacío, amplía el periodo o quita el filtro de categoría.'],
  },
  {
    clave: 'configurar_usuarios',
    titulo: 'Crear usuarios y asignar permisos',
    ruta: '#/configuracion/usuarios',
    palabras: ['usuario', 'usuarios', 'permiso', 'permisos', 'rol', 'roles', 'contraseña', 'clave', 'empleado', 'vendedor nuevo'],
    pasos: [
      'Abre Configuración › Usuarios (ruta #/configuracion/usuarios). Solo el administrador puede hacerlo.',
      'Toca "Nuevo usuario": nombre, usuario de acceso, rol (vendedor, cajero, encargado de inventario, consulta o administrador) y una contraseña temporal. El usuario deberá cambiarla al entrar.',
      'Si administra comisiones, define el tipo comercial, el salario mensual (solo si es distinto al general) y el porcentaje de comisión.',
      'Para ajustar qué puede hacer cada rol, ve a Configuración › Permisos y marca o desmarca permisos; los usuarios los verán al recargar.',
      'Si alguien olvida su contraseña, desde "Usuarios" puedes restablecerla o entregarle el código de recuperación que genera la pantalla de entrada.',
    ],
    consejos: ['Desactiva un usuario en lugar de borrarlo: su historial se conserva.'],
  },
  {
    clave: 'inventario_producto',
    titulo: 'Crear un producto y ajustar existencias',
    ruta: '#/inventario/nuevo',
    palabras: ['producto', 'productos', 'inventario', 'stock', 'existencias', 'ajuste', 'agotado', 'crear producto', 'precio'],
    pasos: [
      'Abre Inventario y toca "Nuevo producto" (ruta #/inventario/nuevo): nombre y precio de venta son obligatorios; agrega categoría, marca, referencia, código de barras y stock mínimo.',
      'Para celulares marca "Controlar por IMEI": cada equipo queda identificado por su serial.',
      'Las unidades entran normalmente por Compras (cada compra crea un lote con su costo). Para corregir existencias usa "Ajustar stock" indicando el motivo (entrada, salida o pérdida).',
      'Cambia el precio de venta desde la ficha del producto dejando el motivo; queda en el historial de precios.',
    ],
    consejos: ['El filtro "pocas unidades / agotados" muestra qué reponer.'],
  },
  {
    clave: 'devolucion',
    titulo: 'Registrar una devolución o anular una venta',
    ruta: '#/ventas',
    palabras: ['devolución', 'devolucion', 'devolver', 'anular', 'anulación', 'cambio', 'garantía', 'garantia', 'reintegro'],
    pasos: [
      'Abre el historial de Ventas (ruta #/ventas) y busca la venta por número, cliente o producto.',
      'Ábrela y elige "Devolución" para devolver uno o varios productos (total o parcial) o "Anular" para dejar sin efecto toda la venta. Ambas piden un motivo.',
      'Indica cómo se devuelve el dinero (efectivo, transferencia…) o si se descuenta del crédito pendiente.',
      'Confirma. Las unidades vuelven al mismo lote, el reintegro sale de la caja y la venta queda marcada; el historial nunca se borra.',
    ],
    consejos: ['Si la venta ya estaba liquidada en comisiones, se genera un ajuste trazable sin modificar la liquidación cerrada.'],
  },
];

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function listaTemas() {
  return TEMAS.map((t) => ({ clave: t.clave, titulo: t.titulo, ruta: t.ruta }));
}

// Busca el tema por clave exacta o por palabras clave; devuelve null si no hay coincidencia razonable.
function buscarTema(tema) {
  const q = normalizar(tema).trim();
  if (!q) return null;
  const exacto = TEMAS.find((t) => t.clave === q.replace(/\s+/g, '_'));
  if (exacto) return exacto;
  let mejor = null; let puntaje = 0;
  for (const t of TEMAS) {
    let p = 0;
    for (const palabra of t.palabras) { const w = normalizar(palabra); if (q.includes(w)) p += w.length; }
    if (normalizar(t.titulo).includes(q)) p += 50;
    if (p > puntaje) { puntaje = p; mejor = t; }
  }
  return puntaje > 0 ? mejor : null;
}

function textoTema(t) {
  return [`${t.titulo}`, `Pantalla: ${t.ruta}`, '', 'Pasos:', ...t.pasos.map((p, i) => `${i + 1}. ${p}`), ...(t.consejos && t.consejos.length ? ['', 'Consejos:', ...t.consejos.map((c) => `- ${c}`)] : [])].join('\n');
}

// Punto de entrada de la herramienta `guia_de_uso`.
function guia(tema) {
  const t = buscarTema(tema);
  if (!t) return { encontrado: false, mensaje: 'No tengo una guía para ese tema.', temas_disponibles: listaTemas() };
  return { encontrado: true, clave: t.clave, titulo: t.titulo, ruta: t.ruta, texto: textoTema(t), pasos: t.pasos, consejos: t.consejos || [] };
}

module.exports = { TEMAS, listaTemas, buscarTema, guia, textoTema };
