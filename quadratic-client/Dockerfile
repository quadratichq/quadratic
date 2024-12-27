###########################################################################################
# Builder 1 - Build wasm (core)
###########################################################################################
FROM node:18 AS wasm-builder

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
RUN rustup target add wasm32-unknown-unknown

WORKDIR /quadratic

# trigger rebuild if updateAlertVersion.json changes
COPY updateAlertVersion.json .

# Copy required files for building wasm
COPY package.json .
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts

# Build wasm
RUN echo 'Building wasm...' && npm run build --workspace=quadratic-core


###########################################################################################
# Builder 2 - Build TS/Rust types
###########################################################################################
FROM node:18 AS ts-rust-types-builder

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
RUN rustup target add wasm32-unknown-unknown

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
RUN rustup target add wasm32-unknown-unknown

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
RUN echo 'Building rust-client...' && npm run build --workspace=quadratic-rust-client


###########################################################################################
# Builder 4 - Combine all builder files and build the client
###########################################################################################
FROM node:18 AS vite-build

# Install python
RUN apt-get update && apt-get install -y --no-install-recommends python-is-python3 python3-pip

WORKDIR /quadratic

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

# Copy rest of the files
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-rust-client/. ./quadratic-rust-client/
COPY ./quadratic-kernels/python-wasm/. ./quadratic-kernels/python-wasm/
COPY ./quadratic-shared/. ./quadratic-shared/
COPY ./quadratic-client/. ./quadratic-client/

# Copy files from wasm, ts/rust types, and rust client builders
COPY --from=wasm-builder /quadratic/quadratic-client/src/app/quadratic-core/. ./quadratic-client/src/app/quadratic-core
COPY --from=ts-rust-types-builder /quadratic/quadratic-client/src/app/quadratic-core-types/. ./quadratic-client/src/app/quadratic-core-types
COPY --from=rust-client-builder /quadratic/quadratic-client/src/app/quadratic-rust-client/. ./quadratic-client/src/app/quadratic-rust-client

# Run the packaging script for quadratic_py
RUN ./quadratic-kernels/python-wasm/package.sh --no-poetry

# Build the quadratic-shared
RUN echo 'Building quadratic-shared...' && npm run compile --workspace=quadratic-shared

# Build the front-end
ENV VITE_DEBUG=VITE_DEBUG_VAL
ENV VITE_QUADRATIC_API_URL=VITE_QUADRATIC_API_URL_VAL
ENV VITE_QUADRATIC_MULTIPLAYER_URL=VITE_QUADRATIC_MULTIPLAYER_URL_VAL
ENV VITE_QUADRATIC_CONNECTION_URL=VITE_QUADRATIC_CONNECTION_URL_VAL
ENV VITE_AUTH_TYPE=VITE_AUTH_TYPE_VAL
ENV VITE_STORAGE_TYPE=VITE_STORAGE_TYPE_VAL
ENV VITE_ORY_HOST=VITE_ORY_HOST_VAL
RUN echo 'Building front-end...' && npm run build --workspace=quadratic-client


###########################################################################################
# Runner - Serve the client with nginx
###########################################################################################
FROM nginx:stable-alpine

COPY --from=vite-build /quadratic/build /usr/share/nginx/html

EXPOSE 80 443 3000

CMD ["nginx", "-g", "daemon off;"]