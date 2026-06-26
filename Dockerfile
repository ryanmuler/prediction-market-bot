# Prediction Market Bot - Dockerfile for Railway
FROM node:20-slim
WORKDIR /app
# Install system dependencies needed for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# Ensure dev dependencies are installed during the build stage
ENV NODE_ENV=development
# Copy all source code
COPY . .
# Install ALL dependencies (cache-bust v2)
RUN npm install --include=dev --legacy-peer-deps
# Safety net: guarantee build tools exist
RUN ls node_modules/.bin/vite || npm install vite esbuild --legacy-peer-deps
# Build the frontend and server bundle
RUN npm run build
# Switch to production for runtime
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
