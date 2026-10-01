FROM node:22-alpine AS build
RUN apk add --no-cache python3 py3-pip
RUN python3 -m venv /opt/ytmusic-venv
COPY server/requirements.txt /tmp/server-requirements.txt
RUN /opt/ytmusic-venv/bin/pip install --no-cache-dir -r /tmp/server-requirements.txt
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PATH="/opt/ytmusic-venv/bin:${PATH}"
WORKDIR /app
RUN apk add --no-cache python3

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/shared/package.json ./shared/package.json
COPY --from=build --chown=node:node /app/shared/dist ./shared/dist
COPY --from=build --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/server/migrations ./server/migrations
COPY --from=build --chown=node:node /app/server/python ./server/python
COPY --from=build --chown=node:node /app/ytmusic-function/catalog.py ./ytmusic-function/catalog.py
COPY --from=build --chown=node:node /app/web/dist ./web/dist
COPY --from=build --chown=node:node /opt/ytmusic-venv /opt/ytmusic-venv

USER node
EXPOSE 3000
CMD ["node", "server/dist/main.js"]
