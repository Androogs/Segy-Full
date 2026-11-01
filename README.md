# SEGY · Panel de gestión

Sistema administrativo para el negocio de celulares y accesorios **SEGY**: inventario por lotes (FIFO / promedio), compras con lectura de facturas por IA, ventas, créditos y cartera, caja y gastos, contabilidad con TRM, celulares usados, comisiones, marketing y reportes (PDF / Excel).

Versión 3.0 — proyecto separado en **backend** y **frontend**. El frontend es una aplicación **React + TypeScript** servida con **Vite**.

```
segy-panel/
├── backend/     API REST · Node.js 22 + Express 5 + SQLite integrado (seguridad, datos, PDF, OCR)
├── frontend/    Interfaz web · React 19 + TypeScript 5 + Vite 6
├── docs/        Despliegue en Hostinger, seguridad y base de datos
└── package.json Monorepo (npm workspaces): instala y ejecuta ambos con un solo comando
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
# 1. Instalar dependencias de backend y frontend (un solo comando, desde la raíz)
npm install

# 2. Configuración local del backend
cp backend/.env.development.example backend/.env      # Windows: copy backend\.env.development.example backend\.env

# 3. Base de datos con datos de demostración
npm run seed

# 4. Arrancar backend (API :3400) y frontend (Vite :5173) a la vez
npm run dev
```

Abre **http://localhost:5173**. Vite recarga la interfaz al instante cuando guardas cambios y reenvía `/api` al backend.

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
npm run build     # verifica tipos (tsc) y compila el frontend en frontend/dist
npm test          # 22 pruebas automáticas del backend
npm start         # el backend sirve la API y el frontend compilado en http://localhost:3400
```

---

## Comandos (desde la raíz)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend + frontend en modo desarrollo |
| `npm run dev:backend` / `npm run dev:frontend` | Solo uno de los dos |
| `npm run build` | Revisión de tipos + build optimizado del frontend |
| `npm run typecheck` | Solo la revisión de tipos TypeScript |
| `npm start` | Servidor de producción (API + frontend compilado) |
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

Más documentación: [Seguridad](docs/SEGURIDAD.md) · [Base de datos](docs/BASE-DE-DATOS.md) · [Cambios](CAMBIOS.md)
