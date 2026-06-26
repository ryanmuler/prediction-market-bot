# Prediction Market Bot - Dockerfile for Railway
FROM node:20-slim
WORKDIR /app
# Install system dependencies needed for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=development
# Copy all source code
COPY . .
# Remove any existing lockfile/modules and do a clean full install (cache-bust v7)
RUN rm -rf package-lock.json node_modules
RUN npm install --include=dev --legacy-peer-deps --no-audit --no-fund
# Build the application (vite build + esbuild server bundle) via the project script
RUN npm run build
# Switch to production for runtime
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
