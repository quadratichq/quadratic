###########################################################################################
# Builder 1 - Build core
###########################################################################################
FROM node:18 AS core-builder

ARG CLIENT_DEV

# Install build-essential, llvm, and clang
RUN apt-get update && apt-get install -y --no-install-recommends build-essential llvm clang

# Install rustup
RUN echo 'Installing rustup...' && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
ENV CARGO_TARGET_DIR=/quadratic/target
ENV CARGO_HOME=/quadratic/.cargo
ENV CARGO_BUILD_JOBS=64
ENV RUSTFLAGS='-C codegen-units=64'

# Install wasm-pack
RUN echo 'Installing wasm-pack...' && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
RUN echo 'wasm-pack version:' && wasm-pack --version

# Install wasm32-unknown-unknown target
RUN echo 'Installing wasm32-unknown-unknown target...' && rustup target add wasm32-unknown-unknown

WORKDIR /quadratic

# trigger rebuild if updateAlertVersion.json changes
COPY updateAlertVersion.json .

# Copy required files for building core
COPY package.json .
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts

# Build core
RUN if [ "$CLIENT_DEV" = "true" ]; then \
  echo 'Building core in dev mode...' && npm run build:dev --workspace=quadratic-core; \
  else \
  echo 'Building core...' && npm run build --workspace=quadratic-core; \
  fi


###########################################################################################
# Builder 2 - Build TS/Rust types
###########################################################################################
FROM node:18 AS ts-rust-types-builder

# Install build-essential, llvm, and clang
RUN apt-get update && apt-get install -y --no-install-recommends build-essential llvm clang

# Install rustup
RUN echo 'Installing rustup...' && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
ENV CARGO_TARGET_DIR=/quadratic/target
ENV CARGO_HOME=/quadratic/.cargo
ENV CARGO_BUILD_JOBS=64
ENV RUSTFLAGS='-C codegen-units=64'

# Install wasm-pack
RUN echo 'Installing wasm-pack...' && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
RUN echo 'wasm-pack version:' && wasm-pack --version

# Install wasm32-unknown-unknown target
RUN echo 'Installing wasm32-unknown-unknown target...' && rustup target add wasm32-unknown-unknown

WORKDIR /quadratic

# trigger rebuild if updateAlertVersion.json changes
COPY updateAlertVersion.json .

# Copy required files for building ts/rust types
COPY package.json .
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts

# Build TS/Rust types
RUN echo 'Building TS/Rust types...' && npm run export_types --workspace=quadratic-core


###########################################################################################
# Builder 3 - Build rust client
###########################################################################################
FROM node:18 AS rust-client-builder

ARG CLIENT_DEV

# Install build-essential, llvm, and clang
RUN apt-get update && apt-get install -y --no-install-recommends build-essential llvm clang

# Install rustup
RUN echo 'Installing rustup...' && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
ENV CARGO_TARGET_DIR=/quadratic/target
ENV CARGO_HOME=/quadratic/.cargo
ENV CARGO_BUILD_JOBS=64
ENV RUSTFLAGS='-C codegen-units=64'

# Install wasm-pack
RUN echo 'Installing wasm-pack...' && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
RUN echo 'wasm-pack version:' && wasm-pack --version

# Install wasm32-unknown-unknown target
RUN echo 'Installing wasm32-unknown-unknown target...' && rustup target add wasm32-unknown-unknown

WORKDIR /quadratic

# trigger rebuild if updateAlertVersion.json changes
COPY updateAlertVersion.json .

# Copy required files for building rust client
COPY package.json .
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
COPY ./quadratic-rust-client/. ./quadratic-rust-client/

# Build the rust-client
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT
RUN if [ "$CLIENT_DEV" = "true" ]; then \
  echo 'Building rust-client in dev mode...' && npm run build:dev --workspace=quadratic-rust-client; \
  else \
  echo 'Building rust-client...' && npm run build --workspace=quadratic-rust-client; \
  fi


###########################################################################################
# Builder 4 - Combine all builder files and build the client
###########################################################################################
FROM node:18 AS vite-builder

WORKDIR /quadratic

# Copy files from core, ts/rust types, and rust client builders
COPY --from=core-builder /quadratic/quadratic-client/src/app/quadratic-core/. ./quadratic-client/src/app/quadratic-core
COPY --from=ts-rust-types-builder /quadratic/quadratic-client/src/app/quadratic-core-types/. ./quadratic-client/src/app/quadratic-core-types
COPY --from=rust-client-builder /quadratic/quadratic-client/src/app/quadratic-rust-client/. ./quadratic-client/src/app/quadratic-rust-client

# Install system brotli instead of Rust version
RUN apt-get update && apt-get install -y --no-install-recommends \
  python-is-python3 \
  python3-pip \
  brotli \
  pigz

# Copy updateAlertVersion.json
COPY updateAlertVersion.json .

# Copy all package.json files
COPY package.json .
COPY package-lock.json .
COPY ./quadratic-kernels/python-wasm/package*.json ./quadratic-kernels/python-wasm/
COPY ./quadratic-core/package*.json ./quadratic-core/
COPY ./quadratic-rust-client/package*.json ./quadratic-rust-client/
COPY ./quadratic-shared/package*.json ./quadratic-shared/
COPY ./quadratic-client/package*.json ./quadratic-client/

# Install npm dependencies
RUN npm install --no-audit --no-fund

# Copy remaining files
COPY ./quadratic-kernels/python-wasm/. ./quadratic-kernels/python-wasm/
COPY ./quadratic-shared/. ./quadratic-shared/
COPY ./quadratic-client/. ./quadratic-client/

# Run the packaging script for quadratic_py
RUN ./quadratic-kernels/python-wasm/package.sh --no-poetry

# Build the quadratic-shared
RUN echo 'Building quadratic-shared...' && npm run compile --workspace=quadratic-shared

# Build the front-end
ENV VITE_DEBUG=VITE_DEBUG_VAL
ENV VITE_QUADRATIC_API_URL=VITE_QUADRATIC_API_URL_VAL
ENV VITE_QUADRATIC_MULTIPLAYER_URL=VITE_QUADRATIC_MULTIPLAYER_URL_VAL
ENV VITE_QUADRATIC_CONNECTION_URL=VITE_QUADRATIC_CONNECTION_URL_VAL
ENV VITE_STORAGE_TYPE=VITE_STORAGE_TYPE_VAL
ENV VITE_AUTH_TYPE=VITE_AUTH_TYPE_VAL
ENV VITE_AUTH0_ISSUER=VITE_AUTH0_ISSUER_VAL
ENV VITE_AUTH0_DOMAIN=VITE_AUTH0_DOMAIN_VAL
ENV VITE_AUTH0_CLIENT_ID=VITE_AUTH0_CLIENT_ID_VAL
ENV VITE_AUTH0_AUDIENCE=VITE_AUTH0_AUDIENCE_VAL
ENV VITE_ORY_HOST=VITE_ORY_HOST_VAL
ENV VITE_SENTRY_AUTH_TOKEN=VITE_SENTRY_AUTH_TOKEN_VAL
RUN echo 'Building front-end...' && npm run build --workspace=quadratic-client

# Compress files (except js/mjs/cjs/jsx/ts/tsx, these are done in replace_env_vars.sh)
RUN find /quadratic/build -type f \
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
  '


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