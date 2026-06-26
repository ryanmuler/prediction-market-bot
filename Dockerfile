# Prediction Market Bot - Dockerfile for Railway
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=development
COPY . .
RUN rm -rf package-lock.json node_modules
RUN npm install --include=dev --legacy-peer-deps --no-audit --no-fund
RUN node node_modules/vite/bin/vite.js build
RUN ./node_modules/.bin/esbuild api/boot.ts --platform=node --bundle --format=esm --outdir=dist --banner:js="import { createRequire } from 'module';const require = createRequire(import.meta.url);"
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
