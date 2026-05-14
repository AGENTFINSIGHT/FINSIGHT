FROM node:20-alpine

WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# Cloud Run injects PORT=8080 automatically
EXPOSE 8080

CMD ["node", "src/index.js"]
