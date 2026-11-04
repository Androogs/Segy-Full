# Opcional (VPS con Docker). Compila el panel y la tienda web y ejecuta el backend con solo lo necesario.
# La tienda se sirve en los dominios de TIENDA_HOSTS (docker run -e TIENDA_HOSTS=segy.com.co,www.segy.com.co …).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY tienda/package.json tienda/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=3400 DATA_DIR=/data TZ=America/Bogota
WORKDIR /app
RUN addgroup -S segy && adduser -S segy -G segy && mkdir -p /data && chown segy:segy /data
COPY --from=build --chown=segy:segy /app/package*.json ./
COPY --from=build --chown=segy:segy /app/backend ./backend
COPY --from=build --chown=segy:segy /app/frontend/dist ./frontend/dist
COPY --from=build --chown=segy:segy /app/frontend/package.json ./frontend/package.json
COPY --from=build --chown=segy:segy /app/tienda/dist ./tienda/dist
COPY --from=build --chown=segy:segy /app/tienda/package.json ./tienda/package.json
RUN npm ci --omit=dev -w backend --include-workspace-root=false && npm cache clean --force
USER segy
EXPOSE 3400
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3400/api/salud || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "backend/server/index.js"]
