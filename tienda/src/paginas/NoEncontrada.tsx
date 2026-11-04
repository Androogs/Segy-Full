import { Enlace } from '../lib/ruta';
import { usePagina } from '../lib/seo';

export function NoEncontrada({ titulo = 'Esta página no existe', texto = 'Puede que el enlace esté incompleto o que la página se haya movido.' }: { titulo?: string; texto?: string }) {
  usePagina(titulo);
  return (
    <div className="contenedor no-encontrada">
      <img src="/marca/astro.webp" alt="Astro, la mascota de SEGY" />
      <h1 className="titulo-2">{titulo}</h1>
      <p className="secundario">{texto}</p>
      <div className="fila"><Enlace a="/" className="boton boton--claro">Ir al inicio</Enlace><Enlace a="/catalogo" className="boton boton--contorno">Ver catálogo</Enlace></div>
    </div>
  );
}
