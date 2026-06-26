# Prediction Market Bot - Dockerfile for Railway
FROM node:20-slim
WORKDIR /app
# Install system dependencies needed for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=development
# Copy all source code
COPY . .
# Install all dependencies (cache-bust v5)
RUN npm install --include=dev --legacy-peer-deps --no-audit --no-fund
# Build frontend with vite (invoke binary directly to avoid PATH issues)
RUN node node_modules/vite/bin/vite.js build
# Bundle the server with esbuild
RUN node node_modules/esbuild/bin/esbuild api/boot.ts --platform=node --bundle --format=esm --outdir=dist --banner:js="import { createRequire } from 'module';const require = createRequire(import.meta.url);"
# Switch to production for runtime
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
