# Use an official node image as a parent image
FROM node:18 AS build

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

# Install python
RUN apt-get update && apt-get install -y --no-install-recommends python-is-python3 python3-pip

WORKDIR /quadratic

# Copy root dependencies
# Any changes to these files will trigger a full rebuild (version change)
COPY updateAlertVersion.json .
COPY package.json .

# Run the packaging script for quadratic_py
COPY ./quadratic-kernels/python-wasm/. ./quadratic-kernels/python-wasm/
RUN ./quadratic-kernels/python-wasm/package.sh --no-poetry

# Build wasm and export TS/Rust types
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
RUN echo 'Building wasm...' && npm run build --workspace=quadratic-core

# Build the quadratic-rust-client
COPY ./quadratic-rust-client/. ./quadratic-rust-client/
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT
RUN echo 'Building quadratic-rust-client...' && npm run build --workspace=quadratic-rust-client

# Install npm dependencies
COPY package-lock.json .
COPY ./quadratic-shared/package*.json ./quadratic-shared/
COPY ./quadratic-client/package*.json ./quadratic-client/
RUN npm install --no-audit --no-fund

# Build the quadratic-shared
COPY ./quadratic-shared/. ./quadratic-shared/
RUN echo 'Building quadratic-shared...' && npm run compile --workspace=quadratic-shared

# Build the front-end
COPY ./quadratic-client/. ./quadratic-client/
ENV VITE_DEBUG=VITE_DEBUG_VAL
ENV VITE_QUADRATIC_API_URL=VITE_QUADRATIC_API_URL_VAL
ENV VITE_QUADRATIC_MULTIPLAYER_URL=VITE_QUADRATIC_MULTIPLAYER_URL_VAL
ENV VITE_QUADRATIC_CONNECTION_URL=VITE_QUADRATIC_CONNECTION_URL_VAL
ENV VITE_AUTH_TYPE=VITE_AUTH_TYPE_VAL
ENV VITE_STORAGE_TYPE=VITE_STORAGE_TYPE_VAL
ENV VITE_ORY_HOST=VITE_ORY_HOST_VAL
RUN echo 'Building front-end...' && npm run build --workspace=quadratic-client

# The default command to run the application
# CMD ["npm", "run", "start:production"]

FROM nginx:stable-alpine
COPY --from=build /quadratic/build /usr/share/nginx/html

EXPOSE 80 443 3000

CMD ["nginx", "-g", "daemon off;"]
