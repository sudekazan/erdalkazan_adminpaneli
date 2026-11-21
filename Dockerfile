FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Uygulama dosyaları root'a ait kalır; uygulama diske yazmaz,
# node kullanıcısının yalnızca okuması yeterli.
COPY . .
USER node

EXPOSE 3000
# /healthz MongoDB bağlıyken 200 döner; değilse kapsayıcı "unhealthy" olur.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" > /dev/null || exit 1
CMD ["node", "server.js"]
