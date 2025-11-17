# Stage 1: Build Vue client
FROM node:20-alpine AS vue-builder

WORKDIR /app/vue_client

# Copy Vue client package files
COPY vue_client/package*.json ./

# Install Vue client dependencies
RUN npm install

# Copy Vue client source code
COPY vue_client ./

# Build Vue client
RUN npm run build

# Stage 2: Setup server
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy server code
COPY server ./server

# Copy built Vue client from builder stage
COPY --from=vue-builder /app/vue_client/dist ./vue_client/dist

# Create data directory
RUN mkdir -p /app/data/images

# Expose port
EXPOSE 8005

# Start server
CMD ["node", "server/server.js"]
