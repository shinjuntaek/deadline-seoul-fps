FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit
COPY multiplayer ./multiplayer
COPY api ./api
ENV PORT=8080 COOP_SINGLE_INSTANCE=1 NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "multiplayer/server.mjs"]
