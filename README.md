# SEGY · Panel de gestión y tienda web

Sistema administrativo para el negocio de celulares y accesorios **SEGY**: inventario por lotes (FIFO / promedio), compras con lectura de facturas por IA, ventas, créditos y cartera, caja y gastos, contabilidad con TRM, celulares usados, comisiones, marketing y reportes (PDF / Excel).

Versión 3.1 — proyecto separado en **backend**, **frontend** (panel) y **tienda** (página pública). Panel y tienda son aplicaciones **React + TypeScript** servidas con **Vite**.

La **tienda web** es la página del negocio para los clientes: catálogo conectado al inventario, ficha de producto, carrito y pedido, seguimiento del pedido, retoma, crédito con simulador y servicio técnico, con una experiencia 3D de desplazamiento para el producto insignia (iPhone 17 Pro Max). Los pedidos y solicitudes llegan al panel. Guía: **[docs/TIENDA.md](docs/TIENDA.md)**.

```
segy-panel/
├── backend/     API REST · Node.js 22 + Express 5 + SQLite integrado (seguridad, datos, PDF, OCR)
├── frontend/    Panel de gestión · React 19 + TypeScript 5 + Vite 6
├── tienda/      Tienda web pública · React 19 + TypeScript 5 + Vite 6 + three.js
├── docs/        Despliegue en Hostinger, seguridad y base de datos
└── package.json Monorepo (npm workspaces): instala y ejecuta todo con un solo comando
```

---

## Requisitos

| Componente | Versión |
|---|---|
| Node.js | **22.13 o superior** (22 LTS o 24) |
| npm | 10 o superior |
| Base de datos | SQLite integrado en Node.js (no se instala nada) |

---

## Probar en tu computador

```bash
# 1. Instalar dependencias de backend, panel y tienda (un solo comando, desde la raíz)
npm install

# 2. Configuración local del backend
cp backend/.env.development.example backend/.env      # Windows: copy backend\.env.development.example backend\.env

# 3. Base de datos con datos de demostración
npm run seed

# 4. Arrancar backend (API :3400), panel (Vite :5173) y tienda (Vite :5174) a la vez
npm run dev
```

Abre el **panel en http://localhost:5173** y la **tienda en http://localhost:5174**. Vite recarga al instante cuando guardas cambios y reenvía `/api` al backend.

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Astronomical2099*` | Administrador |
| `carlos` | `Vendedor2026*` | Vendedor |
| `luisa` | `Cajera2026*` | Cajera |
| `pedro` | `Inventario2026*` | Inventario |
| `conta` | `Consulta2026*` | Contabilidad / consulta |

> Usuarios **solo de demostración**: `npm run seed` se niega a correr con `NODE_ENV=production`.

### Probar la versión de producción en local

```bash
npm run build     # verifica tipos (tsc) y compila el panel (frontend/dist) y la tienda (tienda/dist)
npm test          # 29 pruebas automáticas del backend (incluida la tienda)
npm start         # API + panel en http://localhost:3400 y tienda en http://tienda.localhost:3400
```

---

## Comandos (desde la raíz)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend + panel + tienda en modo desarrollo |
| `npm run dev:backend` / `dev:frontend` / `dev:tienda` | Solo uno de ellos |
| `npm run build` | Revisión de tipos + build optimizado del panel y de la tienda |
| `npm run build:panel` / `build:tienda` | Solo uno de los dos builds |
| `npm run typecheck` | Solo la revisión de tipos TypeScript (panel y tienda) |
| `npm start` | Servidor de producción (API + panel + tienda compilados) |
| `npm test` | Pruebas automáticas del backend |
| `npm run check` | Verifica el entorno antes de publicar |
| `npm run db:init` | Crea o actualiza la base de datos (nunca borra datos) |
| `npm run crear-admin` | Crea un administrador o restablece su contraseña |
| `npm run seed` | Datos de demostración (solo desarrollo) |
| `npm run backup` | Copia de seguridad de la base de datos |

---

## Arquitectura

**En desarrollo** hay dos procesos: Vite (`:5173`) sirve la interfaz con recarga instantánea y reenvía `/api`, `/comprobante` y `/marketing` al backend (`:3400`).

**En producción** hay un solo proceso: el backend sirve la API y los archivos compilados de `frontend/dist`. Así se publica como una sola aplicación Node.js en Hostinger, con el mismo dominio para la interfaz y la API (las cookies de sesión y la protección CSRF funcionan sin configurar CORS).

### Backend (`backend/`)

```
server/
  index.js        Servidor Express: cabeceras de seguridad, límites, rutas, archivos estáticos
  config.js       Variables de entorno validadas (lee backend/.env)
  db.js           SQLite, esquema y migraciones automáticas
  schema.sql      Esquema completo (45 tablas)
  auth.js         Sesiones, CSRF, token de API, permisos
  seguridad.js    bcrypt, política de contraseñas, cifrado
  routes/         Endpoints de la API
  services/       Lógica de negocio (inventario, ventas, contabilidad, marketing…)
assets/           Script de seguimiento web para la página del negocio
scripts/          db:init, crear-admin, backup, check
tests/            Pruebas automáticas (node:test)
```

### Frontend (`frontend/`)

```
index.html            Documento base (Vite)
vite.config.ts        Servidor de desarrollo con proxy, build y generación del service worker
src/
  main.tsx            Entrada de React
  App.tsx             Sesión, acceso y enrutamiento por hash (#/seccion)
  lib/                Núcleo tipado: api.ts (CSRF), estado.ts, sesion.ts, ruta.ts, modulos.ts, vistas.ts, tipos.ts
  layout/             Barra lateral, barra superior y barra inferior del celular
  views/              Pantallas en React: Login.tsx, Inicio.tsx
  components/         Icono.tsx, PantallaHeredada.tsx
  legacy/             Pantallas existentes en JavaScript, montadas dentro de React (ver frontend/README.md)
  styles/             Hojas de estilo del diseño aprobado
public/               Iconos, manifiesto PWA y librería del escáner
```

Ver **[frontend/README.md](frontend/README.md)** para el estado de la migración a React y cómo migrar cada pantalla.

### Tienda web (`tienda/`)

```
src/
  experiencia/        Experiencia 3D de desplazamiento del inicio (three.js, carga bajo demanda, respaldo 2D)
  contenido/          Textos editables: producto insignia, servicios, legales
  paginas/            Inicio, catálogo, producto, carrito, pagar, pedido, retoma, crédito, servicio técnico, visítanos
  componentes/, lib/, estilos/
```

En el backend, `server/routes/tienda.js` y `server/services/tienda.js` exponen la API pública (`/api/publico/tienda`,
sin sesión, con límites por IP) y la gestión del panel (`/api/tienda`, con permisos `tienda.*`). En producción el backend
entrega la tienda en los dominios de `TIENDA_HOSTS` y el panel en los demás. Detalles en **[docs/TIENDA.md](docs/TIENDA.md)**.

---

## Publicar en Hostinger

Guía paso a paso: **[docs/DESPLIEGUE-HOSTINGER.md](docs/DESPLIEGUE-HOSTINGER.md)**.

Resumen: se publica como **Aplicación Node.js** (planes Business / Cloud) o en un **VPS**. **No se sube a `public_html`.**

| Campo en Hostinger | Valor |
|---|---|
| Versión de Node.js | 22.x |
| Comando de instalación | `npm install` |
| Comando de compilación | `npm run build` |
| Archivo de entrada | `backend/server/index.js` |
| Comando de inicio | `npm start` |
| Variable para la tienda | `TIENDA_HOSTS=tudominio.com,www.tudominio.com` (el panel queda en otro subdominio, p. ej. `panel.tudominio.com`) |

Más documentación: [Tienda web](docs/TIENDA.md) · [Seguridad](docs/SEGURIDAD.md) · [Base de datos](docs/BASE-DE-DATOS.md) · [Cambios](CAMBIOS.md)
