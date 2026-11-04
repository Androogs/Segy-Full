# Tienda web · React + TypeScript + Vite + three.js

Página pública de SEGY conectada al inventario del panel. Guía completa: **[../docs/TIENDA.md](../docs/TIENDA.md)**.

```
src/
  main.tsx, App.tsx      Entrada, estructura y rutas (enrutador propio sobre la History API: lib/ruta.tsx)
  lib/                   API pública, tipos, carrito (localStorage), datos del negocio, formato, cuotas, SEO, seguimiento
  componentes/           Encabezado, buscador, carrito lateral, tarjeta e ilustraciones de producto, simulador, formularios
  paginas/               Inicio, catálogo, producto, carrito, pagar, pedido, retoma, crédito, servicio técnico, visítanos, legales
  experiencia/           Experiencia 3D del inicio: Experiencia.tsx (desplazamiento), coreografia.ts, escena.ts (three.js),
                         dispositivo.ts (modelo genérico), pantalla.ts (contenido de la pantalla), EquipoPoster.tsx (2D)
  contenido/             Textos editables: insignia.ts (portada), servicios.ts (retoma, grados, técnico), legal.ts
  estilos/               base.css (tokens de marca), componentes.css, experiencia.css, paginas.css
public/marca/            Logo, mascota Astro e íconos (los mismos del panel)
public/media/            Modelo 3D opcional del producto insignia (ver LEEME.md)
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Vite en http://localhost:5174 con proxy de `/api` al backend (:3400) |
| `npm run typecheck` | Revisión estricta de tipos |
| `npm run build` | Tipos + build optimizado en `dist/` (three.js en un archivo aparte que se carga bajo demanda) |
