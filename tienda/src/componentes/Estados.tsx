// Estados de página: error de carga (con reintento) y vacío. Explican qué pasó y qué hacer.
import { Enlace } from '../lib/ruta';

export function ErrorCarga({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div className="error-carga contenedor" role="alert">
      <h2 className="titulo-3">No pudimos cargar esta página</h2>
      <p className="secundario">{mensaje}</p>
      <div className="fila">
        {reintentar && <button type="button" className="boton boton--claro" onClick={reintentar}>Intentar de nuevo</button>}
        <Enlace a="/" className="boton boton--contorno">Ir al inicio</Enlace>
      </div>
    </div>
  );
}

export function Vacio({ titulo, texto, children }: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="vacio">
      <img src="/marca/astro.webp" alt="" width="132" height="132" />
      <h3 className="titulo-3">{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  );
}
