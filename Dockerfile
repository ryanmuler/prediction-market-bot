# Prediction Market Bot - Dockerfile for Railway
FROM node:20-slim
WORKDIR /app
# Install system dependencies needed for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=development
# Ensure locally installed binaries are on PATH
ENV PATH=/app/node_modules/.bin:$PATH
# Copy all source code
COPY . .
# Install all dependencies (cache-bust v4)
RUN npm install --include=dev --legacy-peer-deps --no-audit --no-fund
# Diagnostic: show whether build tools landed in node_modules
RUN echo '--- checking vite ---' && (ls -la node_modules/.bin/ | grep -E 'vite|esbuild' || echo 'NO VITE/ESBUILD IN .bin') && (ls node_modules/vite/package.json && echo 'vite package present' || echo 'vite package MISSING')
# Build the frontend and server bundle
RUN npm run build
# Switch to production for runtime
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
