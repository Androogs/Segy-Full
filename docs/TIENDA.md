# Tienda web pública

La tienda (`tienda/`) es la página del negocio para los clientes. Se alimenta del **mismo inventario del panel**: no hay
un segundo catálogo que mantener. Lo que cambias en el panel (precio, existencias, fotos, publicación) se ve en la página
en menos de un minuto.

```
Cliente en la página ──► /api/publico/tienda (sin sesión, con límites por IP)
                              │
                              ├─ catálogo: productos publicados, precios y disponibilidad (nunca costos ni proveedores)
                              ├─ pedidos web ──► Panel › Tienda web › Pedidos  +  Marketing › Clientes potenciales
                              └─ solicitudes (retoma, crédito, servicio técnico, contacto, aviso de llegada)
                                                ──► Marketing › Clientes potenciales (canal "web")
```

## Qué hay en la tienda

| Página | Dirección | Datos |
|---|---|---|
| Inicio con la experiencia 3D del producto insignia | `/` | Producto de la portada (Tienda web › Ajustes), destacados, usados |
| Catálogo por grupo, categoría, marca y búsqueda | `/catalogo`, `/catalogo/celulares`, `?q=` | Inventario publicado |
| Ficha de producto | `/producto/iphone-17-pro-max-256gb-1` | Producto, fotos, accesorios compatibles |
| Carrito y pago | `/carrito`, `/pagar` | El servidor recalcula precios y existencias |
| Seguimiento del pedido (enlace privado) | `/pedido/<token>` | Estado e historial del pedido |
| Retoma, crédito, servicio técnico, visítanos | `/retoma`, `/credito`, `/servicio-tecnico`, `/tienda` | Solicitudes → clientes potenciales |
| Legales | `/legal/terminos`, `/legal/privacidad`, `/legal/garantia`, `/legal/envios` | Datos del negocio |

Los grupos del catálogo salen del nombre de cada categoría del inventario: "usado" → Usados certificados, "repuesto" →
Repuestos, "celular…" → Celulares y todo lo demás → Accesorios. Las categorías nuevas que crees en Inventario aparecen solas.

## Gestionarla desde el panel (Gestión › Tienda web)

- **Pedidos**: los pedidos web entran como *Nuevo*. Confírmalos por WhatsApp (el botón abre el chat con un mensaje y el
  enlace de seguimiento), avanza el estado (confirmado → pagado → en camino / listo para recoger → entregado) o cancela
  con motivo. **Un pedido web no descuenta inventario ni caja**: registra la venta en *Ventas* como siempre y escribe su
  número en el pedido para dejarlos vinculados. El Inicio del panel avisa cuando hay pedidos nuevos.
- **Productos en la web**: publicar u ocultar, destacar en la portada y "precio antes" para mostrarlo como oferta.
  Precio, descripción, color, capacidad y **fotos** se editan en *Inventario*. Sin fotos, la tienda muestra una ilustración
  de la categoría en el color del producto.
- **Ajustes**: dirección pública de la tienda, WhatsApp, horario, mapa, mensajes de la barra superior, costos de envío
  (vacío = se confirma con el cliente), formas de pago, planes de crédito (misma fórmula del módulo Créditos), producto de
  la portada y redes sociales.

Permisos nuevos (Configuración › Usuarios y permisos): `tienda.ver`, `tienda.gestionar` (vendedor y cajero) y
`tienda.configurar` (encargado de inventario). El administrador tiene todos.

## Marketing y atribución

- Cada pedido y cada solicitud crean un **cliente potencial** (canal `web`) con los parámetros UTM del anuncio por el que
  llegó la persona, así *Marketing* mide qué campañas traen ventas.
- Si activas el **seguimiento web** (Marketing › Integraciones), la tienda envía también visitas, productos vistos y clics de
  WhatsApp, con el mismo formato del script `segy-seguimiento.js`.

## La experiencia 3D del inicio

| Qué cambiar | Dónde |
|---|---|
| Textos de cada capítulo, especificaciones, acabados y capacidades | `tienda/src/contenido/insignia.ts` |
| Movimiento del equipo (posición, giro, escala por capítulo) y ventanas de cada capítulo | `tienda/src/experiencia/coreografia.ts` |
| Contenido de la pantalla del equipo (bloqueo, cámara, rendimiento, fondo vivo) | `tienda/src/experiencia/pantalla.ts` |
| Modelo, materiales e iluminación | `tienda/src/experiencia/dispositivo.ts`, `escena.ts` |
| Colores y fondos por capítulo | `tienda/src/estilos/experiencia.css` |
| Precio, cuotas y disponibilidad | Panel › Tienda web › Ajustes › Producto de la portada |

La portada usa un **equipo genérico de SEGY** modelado en three.js. Para mostrar el modelo oficial del producto, coloca un
archivo GLB con licencia de uso en `tienda/public/media/` y escribe su ruta en `insignia.ts → modelo3d.url`
(instrucciones en `tienda/public/media/LEEME.md`). Si el archivo falla, vuelve sola al equipo genérico.

**Verifica las especificaciones** de `insignia.ts` con la ficha técnica oficial antes de publicar.

Accesibilidad y rendimiento: three.js se descarga solo cuando la sección entra en pantalla; mientras carga (o sin WebGL)
se anima un equipo 2D con la misma coreografía; con "reducir movimiento" los capítulos se muestran como secciones normales.

## Desarrollo

```bash
npm run dev            # API :3400 + panel :5173 + tienda :5174
npm run dev:tienda     # solo la tienda (necesita el backend en :3400)
npm run build          # compila panel y tienda (tsc + vite)
npm test               # incluye tests/tienda.test.js
```

Con el build hecho, `npm start` sirve el panel en http://localhost:3400 y la tienda en http://tienda.localhost:3400
(los navegadores resuelven `*.localhost` solos).

## Publicar

**Opción 1 · misma aplicación Node.js (recomendada).** Apunta el dominio de la tienda a la misma aplicación de Hostinger y
define `TIENDA_HOSTS=segy.com.co,www.segy.com.co`. El backend entrega la tienda en esos dominios y el panel en los demás
(por ejemplo `panel.segy.com.co`). Mismo proceso, misma base de datos, sin CORS.

**Opción 2 · sitio estático.** Compila con la dirección del backend y sube `tienda/dist` a cualquier hosting estático
(incluido `public_html`):

```bash
VITE_SEGY_API=https://panel.segy.com.co npm run build -w tienda
```

El hosting debe responder `index.html` para cualquier ruta (en Apache, un `.htaccess` con `FallbackResource /index.html`).
La API pública ya acepta peticiones de otros dominios (CORS) solo en `/api/publico/`.

Variables opcionales al compilar: `VITE_SEGY_API` (backend en otro dominio) y `VITE_PANEL_URL` (enlace "Acceso del equipo"
en el pie de página).

## Seguridad

- La API pública nunca devuelve costos, lotes, proveedores, márgenes ni existencias exactas (tope visible de 10 unidades).
- Precios y totales los calcula el servidor; lo que envía el navegador solo indica producto y cantidad.
- Límites por IP: 5 pedidos cada 10 minutos y 6 solicitudes cada 5 minutos. Cuerpos de máximo 32 kB.
- El enlace del pedido usa un token aleatorio de 128 bits y muestra solo el primer nombre, sin teléfono ni dirección.
- Toda solicitud exige la autorización de tratamiento de datos (Ley 1581 de 2012).
- Las fotos públicas solo se sirven si el producto está publicado.

Los textos legales de `tienda/src/contenido/legal.ts` son una plantilla de partida: haz que un abogado los revise.
