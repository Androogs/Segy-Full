/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dirección del backend de SEGY cuando la tienda se publica en otro dominio (p. ej. https://panel.segy.com.co). Vacío = mismo dominio. */
  readonly VITE_SEGY_API?: string;
  /** Enlace al panel de gestión para el pie de página (opcional). */
  readonly VITE_PANEL_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
