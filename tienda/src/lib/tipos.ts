// Tipos de la tienda. Reflejan lo que devuelve /api/publico/tienda (backend/server/services/tienda.js).

export type Grupo = 'celulares' | 'usados' | 'accesorios' | 'repuestos';
export type Grado = 'A' | 'B' | 'C';
export type Pago = 'transferencia' | 'contraentrega' | 'tienda' | 'credito';
export type Entrega = 'recoger' | 'local' | 'nacional';

export interface ProductoResumen {
  id: number;
  slug: string;
  nombre: string;
  marca: string | null;
  grupo: Grupo;
  categoria: { id: number; nombre: string } | null;
  precio: number;
  precio_antes: number | null;
  color: string | null;
  capacidad: string | null;
  modelo_compatible: string | null;
  resumen: string | null;
  foto: string | null;
  disponible: boolean;
  disponibles: number;
  ultimas_unidades: boolean;
  destacado: boolean;
  grado: Grado | null;
}

export interface ProductoDetalle extends ProductoResumen {
  descripcion: string | null;
  referencia: string | null;
  fotos: string[];
  compatibles: ProductoResumen[];
  relacionados: ProductoResumen[];
}

export interface CategoriaCatalogo { id: number; nombre: string; total: number }
export interface GrupoCatalogo { clave: Grupo; nombre: string; descripcion: string; total: number; categorias: CategoriaCatalogo[] }

export interface Negocio {
  nombre: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  nit: string;
  whatsapp: string;
  horario: string;
  mapa_url: string;
  redes: { instagram: string; facebook: string; tiktok: string };
}

export interface Envio { local_nombre: string; local_costo: number | null; nacional: boolean; nacional_costo: number | null; gratis_desde: number | null }
export interface PlanCredito { cuotas: number; interes_pct: number }
export interface Credito { activo: boolean; cuota_inicial_min_pct: number; planes: PlanCredito[] }

export interface DatosInicio {
  negocio: Negocio;
  tienda: {
    activa: boolean;
    mensajes_barra: string[];
    envio: Envio;
    pagos: { clave: Pago; nombre: string }[];
    metodos_transferencia: string[];
    credito: Credito;
  };
  grupos: GrupoCatalogo[];
  insignia: ProductoDetalle | null;
  destacados: ProductoResumen[];
  usados: ProductoResumen[];
  seguimiento: { token: string; endpoint: string } | null;
}

export interface ListaProductos {
  productos: ProductoResumen[];
  total: number;
  pagina: number;
  limite: number;
  marcas: string[];
  rango_precio: { min: number; max: number } | null;
}

export interface PedidoCreado { numero: string; token: string; total: number; subtotal: number; envio: number; envio_por_confirmar: boolean; estado: string }

export interface PedidoPublico {
  numero: string;
  fecha: string;
  estado: string;
  estado_texto: string;
  nombre: string;
  entrega: Entrega;
  entrega_texto: string;
  ciudad: string | null;
  pago: Pago;
  pago_texto: string;
  credito_cuotas: number | null;
  items: { producto_id: number; nombre: string; precio: number; cantidad: number; total: number; slug: string }[];
  subtotal: number;
  envio: number;
  envio_por_confirmar: boolean;
  total: number;
  historial: { fecha: string; estado: string; estado_texto: string }[];
}

export type TipoSolicitud = 'retoma' | 'credito' | 'servicio' | 'contacto' | 'aviso_stock';
