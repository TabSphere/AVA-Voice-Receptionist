# ---- Build stage: build the React client ----
FROM node:20-alpine AS build
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install --no-audit --no-fund
COPY client ./client
RUN cd client && npm run build

# ---- Runtime stage: server + built client ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install -g npm@11.19.0 --no-audit --no-fund
RUN for i in 1 2 3 4 5; do \
      (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund) \
      && node -e "require('dotenv')" && break; \
      echo "retry $i"; sleep 3; \
    done
RUN node -e "require('dotenv'); require('express'); require('openai'); require('twilio'); console.log('deps OK')"
COPY src ./src
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p data public/audio
EXPOSE 3001
ENV PORT=3001
CMD ["node", "src/server.js"]
