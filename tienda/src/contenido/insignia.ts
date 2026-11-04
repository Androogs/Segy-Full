// Contenido de la experiencia del inicio (producto insignia). Todo lo que se lee en la portada sale de aquí y del panel:
//  - Precio, disponibilidad, capacidad y color: del inventario (Tienda web › Ajustes › Producto de la portada).
//  - Textos, especificaciones y acabados: de este archivo. VERIFÍCALOS con la ficha técnica oficial antes de publicar.
// La coreografía (posiciones y giros del equipo en cada capítulo) está en src/experiencia/coreografia.ts.

export type Lado = 'izquierda' | 'derecha' | 'centro';

export interface Capitulo {
  clave: string;
  nombre: string;          // en el riel de navegación
  titulo: string;
  texto: string;
  datos?: { valor: string; detalle: string }[];
  lado: Lado;              // dónde va el texto (el equipo se ubica al lado contrario)
  pantalla: 'bloqueo' | 'camara' | 'rendimiento' | 'vivo';
}

export interface Acabado { nombre: string; marco: string; espalda: string; muestra: string }

export const INSIGNIA = {
  titular: 'iPhone 17 Pro Max',
  bajada: 'Ya está en SEGY Palmira. Estrénalo a cuotas con crédito SEGY o entrega tu celular como parte de pago.',
  capitulos: [
    { clave: 'apertura', nombre: 'Inicio', titulo: 'iPhone 17 Pro Max', texto: '', lado: 'centro', pantalla: 'bloqueo' },
    {
      clave: 'camaras', nombre: 'Cámaras', lado: 'izquierda', pantalla: 'camara',
      titulo: 'Tres cámaras de 48 MP',
      texto: 'Principal, ultra gran angular y teleobjetivo, las tres de 48 megapíxeles. Acércate hasta 8x con calidad óptica sin perder detalle.',
      datos: [{ valor: '48 MP', detalle: 'en las tres cámaras traseras' }, { valor: '8x', detalle: 'zoom con calidad óptica' }],
    },
    {
      clave: 'rendimiento', nombre: 'Rendimiento', lado: 'derecha', pantalla: 'rendimiento',
      titulo: 'Chip A19 Pro',
      texto: 'Cuerpo unibody de aluminio con cámara de vapor: disipa el calor para sostener el rendimiento en juegos, video y edición.',
      datos: [{ valor: 'A19 Pro', detalle: 'el chip más potente de la línea' }, { valor: 'Aluminio', detalle: 'cuerpo unibody' }],
    },
    {
      clave: 'pantalla', nombre: 'Pantalla', lado: 'izquierda', pantalla: 'vivo',
      titulo: '6,9 pulgadas',
      texto: 'Pantalla Super Retina XDR con ProMotion hasta 120 Hz, más brillo a pleno sol y frente Ceramic Shield 2.',
      datos: [{ valor: '120 Hz', detalle: 'ProMotion' }, { valor: '6,9″', detalle: 'Super Retina XDR' }],
    },
    {
      clave: 'colores', nombre: 'Acabados', lado: 'izquierda', pantalla: 'bloqueo',
      titulo: 'Tres acabados',
      texto: 'Elige el tuyo y la capacidad que necesitas. Te confirmamos disponibilidad del color en la tienda.',
    },
    { clave: 'compra', nombre: 'Comprar', titulo: 'Llévatelo hoy', texto: '', lado: 'derecha', pantalla: 'bloqueo' },
  ] as Capitulo[],
  acabados: [
    { nombre: 'Azul profundo', marco: '#2b3650', espalda: '#34415f', muestra: '#34415f' },
    { nombre: 'Naranja cósmico', marco: '#b5582c', espalda: '#cf6a37', muestra: '#d8743f' },
    { nombre: 'Plata', marco: '#b9bcc2', espalda: '#d9dadd', muestra: '#dcdde0' },
  ] as Acabado[],
  capacidades: ['256 GB', '512 GB', '1 TB', '2 TB'],
  // Modelo 3D oficial (opcional). Mientras url sea null se muestra el equipo genérico de SEGY. Ver public/media/LEEME.md.
  modelo3d: { url: null as string | null, escala: 1, rotacionInicial: [0, 0, 0] as [number, number, number] },
};
