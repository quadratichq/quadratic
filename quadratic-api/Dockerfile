FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json .
COPY package-lock.json .
COPY quadratic-api ./quadratic-api
COPY quadratic-shared ./quadratic-shared
RUN npm install

FROM node:18-slim AS runtime
WORKDIR /app
COPY --from=builder /app .
RUN apt-get update && apt install -y openssl
RUN npm run build:prod --workspace=quadratic-api
CMD ["npm", "start:prod"]