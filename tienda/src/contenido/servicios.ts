// Textos de los servicios que la tienda ofrece y que el panel ya gestiona (retoma de usados con inspección y grado,
// crédito a cuotas, servicio técnico con repuestos). Edítalos aquí.

// Mismos grupos de inspección del módulo "Celulares usados" del panel.
export const INSPECCION = ['Pantalla: estado, rayones, táctil y vidrio', 'Batería: salud y autonomía', 'Funcionamiento: botones, audio, cámaras y conectividad', 'Estado físico: carcasa, golpes y humedad', 'Seguridad: IMEI, bloqueos, cuentas y propiedad'];

// Grado comercial de los usados (A/B/C), como lo asigna el panel según la depreciación por condición.
export const GRADOS = [
  { letra: 'A', nombre: 'Como nuevo', texto: 'Sin marcas visibles a distancia normal. Todo funciona y la batería está en buen estado.' },
  { letra: 'B', nombre: 'Detalles leves', texto: 'Marcas ligeras de uso en carcasa o marco. Funcionamiento completo, revisado.' },
  { letra: 'C', nombre: 'Uso visible', texto: 'Señales de uso evidentes, sin afectar el funcionamiento. El mejor precio.' },
];

export const SERVICIOS_TECNICOS = [
  { titulo: 'Cambio de pantalla', texto: 'Pantallas para iPhone, Samsung, Xiaomi y más. Te decimos el tiempo y el valor antes de empezar.' },
  { titulo: 'Cambio de batería', texto: 'Para cuando el celular ya no dura el día o se apaga solo con carga.' },
  { titulo: 'Pin de carga', texto: 'Si no carga, carga a ratos o hay que mover el cable para que funcione.' },
  { titulo: 'Diagnóstico', texto: 'Revisamos el equipo y te explicamos qué tiene y cuánto cuesta arreglarlo.' },
];
