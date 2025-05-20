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

COPY quadratic-api ./quadratic-api
COPY quadratic-shared ./quadratic-shared

###########################################################################################
# Runner
###########################################################################################
FROM node:24-slim AS runtime
WORKDIR /quadratic

# Install required packages with correct verification
RUN apt update && \
  apt install -y openssl && \
  apt install -y openssh-client

COPY --from=builder /quadratic .

RUN npm run postinstall --workspace=quadratic-api
RUN npm run build --workspace=quadratic-api

CMD ["npm", "run", "start:prod"]
