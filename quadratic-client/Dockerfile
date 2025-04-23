###########################################################################################
# Builder 1 - Build core
###########################################################################################
FROM node:23 AS core-builder

ARG CLIENT_DEV

# Install build-essential, llvm, and clang
RUN apt-get update && apt-get install -y --no-install-recommends build-essential llvm clang

# Install rustup
RUN echo 'Installing rustup...' && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
ENV CARGO_TARGET_DIR=/quadratic/target/quadratic-core
ENV CARGO_HOME=/quadratic/.cargo
ENV CARGO_BUILD_JOBS=64

# Install wasm-pack
RUN echo 'Installing wasm-pack...' && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
RUN echo 'wasm-pack version:' && wasm-pack --version

# Install wasm32-unknown-unknown target
RUN echo 'Installing wasm32-unknown-unknown target...' && rustup target add wasm32-unknown-unknown

WORKDIR /quadratic

# Copy required files for building core
COPY --link package.json .
COPY --link ./quadratic-core/. ./quadratic-core/
COPY --link ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
COPY --link ./quadratic-rust-shared/. ./quadratic-rust-shared/

# Build core
RUN if [ "$CLIENT_DEV" = "true" ]; then \
    echo 'Building core in dev mode...' && npm run build:dev --workspace=quadratic-core; \
    else \
    echo 'Building core...' && npm run build --workspace=quadratic-core; \
    fi


###########################################################################################
# Builder 2 - Build TS/Rust types
###########################################################################################
FROM node:23 AS ts-rust-types-builder

# Install build-essential, llvm, and clang
RUN apt-get update && apt-get install -y --no-install-recommends build-essential llvm clang

# Install rustup
RUN echo 'Installing rustup...' && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
ENV CARGO_TARGET_DIR=/quadratic/target/quadratic-core-types
ENV CARGO_HOME=/quadratic/.cargo
ENV CARGO_BUILD_JOBS=64

# Install wasm-pack
RUN echo 'Installing wasm-pack...' && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
RUN echo 'wasm-pack version:' && wasm-pack --version

# Install wasm32-unknown-unknown target
RUN echo 'Installing wasm32-unknown-unknown target...' && rustup target add wasm32-unknown-unknown

WORKDIR /quadratic

# Copy required files for building ts/rust types
COPY --link package.json .
COPY --link ./quadratic-core/. ./quadratic-core/
COPY --link ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
COPY --link ./quadratic-rust-shared/. ./quadratic-rust-shared/

# Build TS/Rust types
RUN echo 'Building TS/Rust types...' && npm run export_types --workspace=quadratic-core


###########################################################################################
# Builder 3 - Combine all builder files and build the client
###########################################################################################
FROM node:23 AS vite-builder

WORKDIR /quadratic

# Copy files from core, ts/rust types, and rust client builders
COPY --link --from=core-builder /quadratic/quadratic-client/src/app/quadratic-core/. ./quadratic-client/src/app/quadratic-core
COPY --link --from=ts-rust-types-builder /quadratic/quadratic-client/src/app/quadratic-core-types/. ./quadratic-client/src/app/quadratic-core-types

# Install system brotli instead of Rust version
RUN apt-get update && apt-get install -y --no-install-recommends \
    python-is-python3 \
    python3-pip \
    brotli \
    pigz

# Copy all package.json files
COPY --link package.json .
COPY --link package-lock.json .
COPY --link ./quadratic-kernels/python-wasm/package*.json ./quadratic-kernels/python-wasm/
COPY --link ./quadratic-core/package*.json ./quadratic-core/
COPY --link ./quadratic-shared/package*.json ./quadratic-shared/
COPY --link ./quadratic-client/package*.json ./quadratic-client/

# Install npm dependencies
RUN npm install --no-audit --no-fund

# Copy remaining files
COPY --link ./quadratic-kernels/python-wasm/. ./quadratic-kernels/python-wasm/
COPY --link ./quadratic-shared/. ./quadratic-shared/
COPY --link ./quadratic-client/. ./quadratic-client/

# Run the packaging script for quadratic_py
RUN ./quadratic-kernels/python-wasm/package.sh --no-poetry

# Hash of the environment variables, as a cache buster
# This is non empty when env variables are set in the github action
ARG ENV_HASH

# If ENV_HASH is set, copy the client.env, otherwise create default .env
RUN if [ ! -z "$ENV_HASH" ]; then \
    echo "ENV_HASH is set, renaming client.env to .env" && \
    mv ./quadratic-client/client.env ./quadratic-client/.env; \
    else \
    echo "ENV_HASH is not set, creating default .env" && \
    echo "VITE_DEBUG=VITE_DEBUG_VAL" > ./quadratic-client/.env && \
    echo "VITE_QUADRATIC_API_URL=VITE_QUADRATIC_API_URL_VAL" >> ./quadratic-client/.env && \
    echo "VITE_QUADRATIC_MULTIPLAYER_URL=VITE_QUADRATIC_MULTIPLAYER_URL_VAL" >> ./quadratic-client/.env && \
    echo "VITE_QUADRATIC_CONNECTION_URL=VITE_QUADRATIC_CONNECTION_URL_VAL" >> ./quadratic-client/.env && \
    echo "VITE_STORAGE_TYPE=VITE_STORAGE_TYPE_VAL" >> ./quadratic-client/.env && \
    echo "VITE_AUTH_TYPE=VITE_AUTH_TYPE_VAL" >> ./quadratic-client/.env && \
    echo "VITE_AUTH0_ISSUER=VITE_AUTH0_ISSUER_VAL" >> ./quadratic-client/.env && \
    echo "VITE_AUTH0_DOMAIN=VITE_AUTH0_DOMAIN_VAL" >> ./quadratic-client/.env && \
    echo "VITE_AUTH0_CLIENT_ID=VITE_AUTH0_CLIENT_ID_VAL" >> ./quadratic-client/.env && \
    echo "VITE_AUTH0_AUDIENCE=VITE_AUTH0_AUDIENCE_VAL" >> ./quadratic-client/.env && \
    echo "VITE_ORY_HOST=VITE_ORY_HOST_VAL" >> ./quadratic-client/.env && \
    echo "VITE_SENTRY_AUTH_TOKEN=VITE_SENTRY_AUTH_TOKEN_VAL" >> ./quadratic-client/.env; \
    fi

# Build the front-end
RUN echo "Building front-end..." && npm run build --workspace=quadratic-client

# Compress files (except js/mjs/cjs/jsx/ts/tsx, these are done in replace_env_vars.sh)
# Compress files only when ENV_HASH is not set, i.e. when env variables are not set in the github action
RUN if [ -z "$ENV_HASH" ]; then \
    find /quadratic/build -type f \
    \( \
    -name "*.wasm" -o \
    -name "*.whl" -o \
    -name "*.json" -o \
    -name "*.css" -o \
    -name "*.html" -o \
    -name "*.svg" -o \
    -name "*.txt" -o \
    -name "*.map" -o \
    -name "*.py" -o \
    -name "*.pyc" -o \
    -name "*.pyi" -o \
    -name "*.pth" -o \
    -name "*.data" -o \
    -name "*.mem" -o \
    -name "*.wat" -o \
    -name "*.md" -o \
    -name "*.rst" -o \
    -name "*.rtf" -o \
    -name "*.csv" -o \
    -name "*.tsv" -o \
    -name "*.eot" -o \
    -name "*.ttf" -o \
    -name "*.otf" -o \
    -name "*.woff" -o \
    -name "*.woff2" -o \
    -name "*.font" -o \
    -name "*.font-sfnt" \
    \) -print0 | \
    xargs -0 -n1 -P$(nproc) -I {} sh -c '\
    echo "Compressing: {}" && \
    brotli -q 9 -w 24 -f "{}" && \
    pigz -6kf "{}" && \
    echo "Created: {}.br and {}.gz" \
    '; \
    fi


###########################################################################################
# Runner - Serve the client with nginx
###########################################################################################
FROM fholzer/nginx-brotli

# Install curl for healthcheck
RUN apk add --no-cache curl brotli pigz

# Copy build directory
COPY --from=vite-builder /quadratic/build /usr/share/nginx/html

EXPOSE 80 443 3000

CMD ["nginx", "-g", "daemon off;"]
