# Prediction Market Bot - Dockerfile for Railway
FROM node:20-slim
WORKDIR /app
# Install system dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# Copy all source code
COPY . .
# Force install of devDependencies (vite, esbuild) regardless of NODE_ENV
ENV NODE_ENV=development
RUN npm install --include=dev
# Build the application
RUN npm run build
# Runtime environment
ENV NODE_ENV=production
# Expose port
EXPOSE 3000
# Start the application
CMD ["npm", "start"]
