# Medios de la experiencia 3D

La portada muestra un **equipo genérico de SEGY** modelado en three.js, con la coreografía de desplazamiento lista.
Para mostrar el modelo oficial del producto que se vende, coloca aquí el archivo del modelo con licencia de uso
y actívalo en `src/contenido/insignia.ts` → `modelo3d.url`.

## Modelo actual: iPhone 17 Pro Max

Archivo esperado: **«iPhone 17 Pro Max» de MajdyModels** (Sketchfab), licencia **CC BY 4.0** (uso comercial permitido
dando crédito al autor — el pie de página ya lo incluye):

<https://sketchfab.com/3d-models/iphone-17-pro-max-87fc1df741384124a8ce0226d2b2058d>

Descarga (requiere una cuenta gratuita de Sketchfab):

1. Abre la página del modelo, inicia sesión y pulsa **Download 3D Model** › formato **glTF**.
2. Descomprime el ZIP en `public/media/iphone-17-pro-max/` (el `.gltf`, el `.bin` y la carpeta `textures/`
   con los nombres que trae el archivo: el .gltf los referencia como rutas relativas).
3. Si el `.gltf` no se llama `scene.gltf`, ajusta `modelo3d.url` en `insignia.ts`.

Al cargar, `src/experiencia/escena.ts` le **oculta la manzana**, le **pega la palmera de SEGY** en la espalda y le
conecta la **pantalla viva** de la experiencia. La detección de esas partes es por nombre de malla/material en
`src/experiencia/externo.ts`; si el archivo usa otros nombres, ahí se ajusta (la consola lista lo encontrado).

## Recomendaciones del archivo

- Formato `.glb` o `.gltf` con sus recursos, menos de 8 MB, texturas en 2K como máximo y comprimidas.
- El frente del equipo mirando hacia +Z, el eje largo vertical (+Y) y el origen en el centro; si viene en otra
  orientación se corrige con `rotacionInicial` en `insignia.ts`.
- Materiales PBR (metalness / roughness). La escena ya trae iluminación de estudio y reflejos.

Si el archivo no carga (ruta equivocada, formato inválido), la página vuelve sola al equipo genérico.
