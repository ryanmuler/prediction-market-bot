# Prediction Market Bot - Dockerfile for Railway

FROM node:20-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
        make \
            g++ \
                && rm -rf /var/lib/apt/lists/*

                # Copy all source code
                COPY . .

                # Install ALL dependencies (including devDependencies for build)
RUN npm install
                # Build the application
                RUN npm run build

                # Expose port
                EXPOSE 3000

                # Start the application
                CMD ["npm", "start"]
