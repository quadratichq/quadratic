###########################################################################################
# Builder - Install dependencies
###########################################################################################
FROM ubuntu:24.04 AS builder

# Install Node.js 24 and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  ca-certificates \
  gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends \
  nodejs \
  && rm -rf /var/lib/apt/lists/*

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
FROM ubuntu:24.04 AS runtime

# Install Node.js 24 and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  ca-certificates \
  gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends \
  nodejs \
  openssl \
  openssh-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /quadratic

RUN npm i -g prisma

COPY --from=builder /quadratic .

CMD ["bash", "-c", "npm run prisma:migrate:deploy --workspace=quadratic-api && npm run start:prod --workspace=quadratic-api"]
