FROM node:23-alpine AS builder
WORKDIR /quadratic

# copy package.json and package-lock.json for npm install
COPY package.json .
COPY package-lock.json .
COPY ./quadratic-api/package*.json ./quadratic-api/
COPY ./quadratic-shared/package*.json ./quadratic-shared/

# copy prisma schema and migrations for postinstall step
COPY ./quadratic-api/prisma/. ./quadratic-api/prisma

RUN npm install

COPY quadratic-api ./quadratic-api
COPY quadratic-shared ./quadratic-shared

FROM node:23-slim AS runtime
WORKDIR /quadratic
COPY --from=builder /quadratic .
RUN apt-get update && apt install -y openssl && apt install -y openssl-client
RUN npm run postinstall --workspace=quadratic-api
RUN npm run build --workspace=quadratic-api
CMD ["npm", "run", "start:prod"]
