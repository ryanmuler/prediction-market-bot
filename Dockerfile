# Prediction Market Bot - Dockerfile for Railway
FROM node:20-slim
WORKDIR /app
# Install system dependencies needed for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=development
# Copy all source code
COPY . .
# Install dependencies; print npm debug log on failure (cache-bust v3)
RUN npm install --include=dev --legacy-peer-deps --no-audit --no-fund || (echo '===== NPM DEBUG LOG =====' && cat /root/.npm/_logs/*-debug-0.log && exit 1)
# Build the frontend and server bundle
RUN npm run build
# Switch to production for runtime
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
