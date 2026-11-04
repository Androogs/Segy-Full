# Medios de la experiencia 3D

La portada muestra un **equipo genérico de SEGY** modelado en three.js, con la coreografía de desplazamiento lista.
Para mostrar el modelo oficial del producto que se vende (por ejemplo el iPhone 17 Pro Max), coloca aquí un archivo
**GLB** con licencia de uso (material de mercadeo del distribuidor autorizado o un modelo 3D comprado con licencia
comercial) y actívalo en `src/contenido/insignia.ts`:

```ts
modelo3d: {
  url: '/media/insignia.glb',   // archivo en esta carpeta
  escala: 1,                    // ajusta hasta que el equipo ocupe lo mismo que el genérico
  rotacionInicial: [0, 0, 0],   // radianes, para corregir la orientación con que viene el archivo
},
```

Recomendaciones del archivo:

- Formato `.glb` (binario), menos de 8 MB, texturas en 2K como máximo y comprimidas.
- El frente del equipo mirando hacia +Z, el eje largo vertical (+Y) y el origen en el centro.
- Materiales PBR (metalness / roughness). La escena ya trae iluminación de estudio y reflejos.

Si el archivo no carga (ruta equivocada, formato inválido), la página vuelve sola al equipo genérico.
