# Cambios de la versión 2.0

## Errores críticos corregidos
- **El sistema no arrancaba:** faltaba `server/schema.sql` (el `.gitignore` excluía todos los `*.sql`). Se reconstruyó el esquema completo (45 tablas, índices y vista de stock) y se validó contra las más de 600 consultas SQL del código.
- **Comprobante público:** la ruta quedaba registrada dos veces con el prefijo y devolvía 404; corregida.
- **Migraciones frágiles:** reemplazadas por una migración automática que compara cada tabla con el esquema oficial y agrega lo que falte sin perder datos.

## Seguridad
| Antes | Ahora |
|---|---|
| Contraseñas con scrypt, mínimo 6 caracteres | bcrypt (costo 12), política de 10+ caracteres con letras y números; migración automática de los hash antiguos |
| Token de sesión guardado en claro, 30 días sin expiración por inactividad | Solo la huella SHA-256; 12 h absolutas y 2 h de inactividad; cookie `__Host-`, `Secure`, `HttpOnly` |
| CSRF solo con una cabecera fija | Token CSRF por sesión + cabecera de la aplicación |
| Login sin bloqueo de cuenta (solo memoria por IP) | Bloqueo por cuenta en la base + límite por IP + sin enumeración de usuarios |
| Código de recuperación de 6 dígitos sin límite de intentos (fuerza bruta posible) | Cifrado AES-256-GCM, verificación HMAC, 5 intentos, 30 min, límite por IP |
| Token de API en claro, visible siempre | Huella SHA-256, se muestra una sola vez |
| Credenciales de prueba visibles en el login y usuarios con contraseñas conocidas | Primer administrador por variables de entorno con cambio obligatorio; demo solo en desarrollo |
| Sin CSP ni HSTS | Helmet con CSP estricta, HSTS, antiframe, Permissions-Policy |
| Cuerpo de 25 MB en toda la API | 1 MB general, 20 MB solo en rutas de archivos |
| Archivos aceptados según el tipo declarado por el navegador | Verificación de la firma real del archivo; servidos en sandbox |
| Enlaces compartidos construidos con `X-Forwarded-Host` (manipulable) | `APP_URL` o host validado |
| Un rol con "administrar usuarios" podía crear administradores | Solo un administrador crea o modifica administradores y permisos de roles |
| Script con IP y acceso root del VPS en el repositorio | Eliminado |
| Huecos puntuales de XSS (métodos de pago, enlaces del asistente, `onclick` en línea) | Corregidos |

## Producción y despliegue
- Configuración central validada (`server/config.js`) con valores seguros por defecto y archivos `.env` de ejemplo.
- Build optimizado con esbuild: JS y CSS minificados, carga por pantalla, nombres con huella y caché del service worker por versión.
- Apagado ordenado, registro estructurado en JSON, comprobación de salud con estado de la base (`/api/salud`).
- Scripts: `check`, `db:init`, `crear-admin`, `backup`.
- Guías de despliegue para Hostinger (Aplicación Node.js y VPS), PM2, Nginx y Docker opcional.
- 22 pruebas automáticas: seguridad, las 78 rutas GET de la API, todos los reportes en JSON/CSV/PDF, flujos completos de venta/compra/caja/crédito y migración de bases antiguas.

## Interfaz
El diseño, los colores, la distribución y la experiencia son los mismos. Cambios visibles mínimos:
- Los datos de prueba del login solo aparecen en desarrollo.
- Los formularios de contraseña validan la política antes de enviar.
- Si un usuario tiene contraseña temporal, al entrar se le lleva a "Mi cuenta" para cambiarla.
- Al generar el token de API se avisa que no se volverá a mostrar.
- Los textos de ayuda que mencionaban el VPS anterior ahora hablan de las variables de entorno del servidor.

## Rediseño del Inicio (2.0.1)
El Inicio dejó de ser un lanzador con una tarjeta por módulo (que repetía el menú lateral) y ahora es un **centro del día**:
- **Encabezado** con fecha y hora en vivo, el saludo (Buenos días / Buenas tardes / Buenas noches) con el nombre del usuario, una frase que resume el día ("Hoy van 3 ventas por $ 3.045.000 y tienes 4 pendientes importantes") y las acciones frecuentes, con **Nueva venta** como acción principal.
- **Estado de la caja**: abierta (desde qué hora y con qué base) o cerrada, con acceso directo para abrirla.
- **Indicadores**: ventas de hoy (destacado en rojo, con comparación contra ayer), ventas del mes (con su avance acumulado), cartera por cobrar y vencida, e inventario con productos por reponer.
- **Pendientes ordenados por urgencia**: cuotas vencidas y por vencer, facturas por pagar a proveedores, productos agotados o con pocas unidades, documentos por revisar, celulares usados por aprobar y caja sin abrir. Cada uno lleva directo a la pantalla filtrada.
- **Últimas ventas** en línea de tiempo y, para el vendedor, **Tu mes** (ventas, vendido y comisión).
- Cada bloque aparece solo si el usuario tiene el permiso correspondiente. Diseño adaptado a celular y respeta el espacio del asistente Astro.
- Archivos: `public/js/views/inicio.js` (reescrito) y `public/css/inicio.css` (nuevo). La guía de uso describe el nuevo Inicio.

## Versión 3.0 · Backend y frontend separados, frontend en React + TypeScript + Vite
- **Estructura de monorepo** con npm workspaces: `backend/` (API Express + SQLite) y `frontend/` (React 19 + TypeScript 5 + Vite 6). Un solo `npm install` en la raíz instala ambos.
- **Desarrollo:** `npm run dev` arranca la API (:3400) y Vite (:5173) con recarga instantánea y proxy de `/api`.
- **Producción:** `npm run build` revisa los tipos y compila el frontend; el backend sirve la API y `frontend/dist` en un solo proceso (misma configuración en Hostinger, solo cambia el archivo de entrada a `backend/server/index.js`).
- **React + TypeScript (modo estricto):** arranque, sesión, enrutamiento, menú lateral, barra superior, barra inferior y menú "Más", pantalla de acceso e Inicio. Núcleo tipado compartido: cliente de API con CSRF, estado de sesión, módulos y permisos.
- **Pantallas existentes** (Ventas, Inventario, Compras, Caja, etc.) montadas dentro de React con `PantallaHeredada`, sin cambios de diseño ni de comportamiento; quedan listas para migrarse a componentes TSX una a una (guía en `frontend/README.md`).
- Service worker generado por Vite con caché por versión; el script de seguimiento web pasó a `backend/assets/`.
- El diseño y los datos no cambian. Las 22 pruebas del backend pasan; verificado en navegador (build de producción y modo desarrollo de Vite): las 20 rutas de la interfaz cargan, creación de datos con CSRF y cierre de sesión, sin errores.
