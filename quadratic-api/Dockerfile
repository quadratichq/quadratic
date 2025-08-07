###########################################################################################
# Builder - Install dependencies
###########################################################################################
FROM node:24 AS builder
WORKDIR /quadratic

# copy package.json for npm install
COPY package.json .
COPY ./quadratic-api/package.json ./quadratic-api/
COPY ./quadratic-shared/package.json ./quadratic-shared/

# copy prisma schema and migrations for postinstall step
COPY ./quadratic-api/prisma/. ./quadratic-api/prisma

RUN npm install --no-audit --no-fund
RUN npm run postinstall --workspace=quadratic-api

COPY quadratic-api ./quadratic-api
COPY quadratic-shared ./quadratic-shared

RUN npm run build --workspace=quadratic-api


###########################################################################################
# Runner
###########################################################################################
FROM node:24-slim AS runtime
WORKDIR /quadratic

# Install openssl for ssh key generation
RUN apt update && \
  apt install -y openssl && \
  apt install -y openssh-client

RUN npm i -g prisma

COPY --from=builder /quadratic .

CMD ["bash", "-c", "npm run prisma:migrate:deploy --workspace=quadratic-api && npm run start:prod --workspace=quadratic-api"]
