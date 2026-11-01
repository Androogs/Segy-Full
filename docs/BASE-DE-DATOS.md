# Base de datos

SEGY usa **SQLite**, el motor integrado en Node.js 22+ (`node:sqlite`). No hay que instalar ni configurar un servidor de base de datos, ni importar nada en phpMyAdmin.

## Cómo se crea

La base se crea **sola** la primera vez que arranca la aplicación, en `DATA_DIR/segy.db` (por defecto `backend/data/segy.db`). En cada arranque:

1. Se aplica `backend/server/schema.sql` (45 tablas, índices y la vista `v_stock`). Todas las sentencias son `IF NOT EXISTS`.
2. Si la base es de una versión anterior, se agregan las columnas que falten y se completan sus datos. **Nunca se borran datos.**

También puedes prepararla manualmente:

```bash
npm run db:init        # crea o actualiza la base y muestra un resumen
npm run crear-admin    # crea el primer administrador
```

`backend/database/schema.sql` es una copia del esquema para consulta o para crear la base con la herramienta `sqlite3`:

```bash
sqlite3 segy.db < backend/database/schema.sql
```

## Qué hay en DATA_DIR

```
DATA_DIR/
  segy.db            Base de datos (más segy.db-wal y segy.db-shm mientras está en uso)
  archivos/AAAA/MM/  Fotos de productos, facturas, comprobantes
  respaldos/         Copias automáticas de la base (las últimas 14)
  .app-secret        Secreto generado si no definiste APP_SECRET
```

## Respaldos

- **Automáticos:** uno diario, se conservan los últimos `BACKUPS_KEEP` (14).
- **Manual desde la app:** Configuración › Respaldos › Descargar (requiere permiso de configuración).
- **Por terminal:** `npm run backup` o `npm run backup -- /ruta/copia.db`.

Los respaldos de la base no incluyen las fotos ni las facturas: copia también la carpeta `archivos/`.

## Restaurar un respaldo

1. Detén la aplicación.
2. Reemplaza `DATA_DIR/segy.db` por el archivo de respaldo (renómbralo a `segy.db`) y elimina `segy.db-wal` y `segy.db-shm` si existen.
3. Inicia la aplicación: el esquema se actualiza solo si el respaldo es de una versión anterior.

## Migrar desde la versión anterior (CeluGestor)

Copia el archivo `celugestor.db` a `DATA_DIR`. Si no existe `segy.db`, la aplicación usa `celugestor.db` automáticamente y lo actualiza. Por seguridad, todos los usuarios deberán iniciar sesión de nuevo (las sesiones antiguas guardaban el token en claro) y el token de API se conserva pero ya no se puede volver a ver.

## ¿Por qué SQLite y no MySQL?

- Viene integrado en Node.js: cero instalación y cero módulos nativos que compilar en el hosting.
- Para un negocio con un punto de venta y un equipo pequeño, rinde de sobra (miles de operaciones por segundo).
- Respaldo = copiar un archivo.
- Las operaciones contables usan transacciones ACID: una venta, su inventario, sus pagos y su crédito se guardan juntos o no se guarda nada.

Limitación: la aplicación debe ejecutarse en **una sola instancia** (no en modo clúster). Si el negocio crece a varias sedes con mucho tráfico simultáneo, se puede migrar a PostgreSQL o MySQL.
