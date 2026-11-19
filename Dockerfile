FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
# Uygulama başlarken uploads klasörü oluşturur; node kullanıcısı yazabilmeli
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
