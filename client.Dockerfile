# Use an official node image as a parent image
FROM node:18 AS build

# Install rustup
RUN echo 'Installing rustup...' && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install wasm-pack
RUN echo 'Installing wasm-pack...' && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Install wasm32-unknown-unknown target
RUN rustup target add wasm32-unknown-unknown

# Install python, binaryen & clean up
RUN apt-get update && apt-get install -y python-is-python3 python3-pip binaryen && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install npm dependencies
WORKDIR /app
COPY package.json .
COPY package-lock.json .
COPY ./quadratic-kernels/python-wasm/package*.json ./quadratic-kernels/python-wasm/
COPY ./quadratic-core/package*.json ./quadratic-core/
COPY ./quadratic-rust-client/package*.json ./quadratic-rust-client/
COPY ./quadratic-shared/package*.json ./quadratic-shared/
COPY ./quadratic-client/package*.json ./quadratic-client/
RUN npm install

# Install typescript
RUN  npm install -D typescript

# Copy the rest of the application
WORKDIR /app
COPY updateAlertVersion.json .
COPY ./quadratic-kernels/python-wasm/. ./quadratic-kernels/python-wasm/
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-rust-client/. ./quadratic-rust-client/
COPY ./quadratic-shared/. ./quadratic-shared/
COPY ./quadratic-client/. ./quadratic-client/

# Run the packaging script for quadratic_py
WORKDIR /app
RUN ./quadratic-kernels/python-wasm/package.sh --no-poetry

# Build wasm
WORKDIR /app/quadratic-core
RUN echo 'Building wasm...' && wasm-pack build --target web --out-dir ../quadratic-client/src/app/quadratic-core --weak-refs

# Export TS/Rust types
WORKDIR /app/quadratic-core
RUN echo 'Exporting TS/Rust types...' && cargo run --bin export_types

# Build the quadratic-rust-client
WORKDIR /app
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT
RUN echo 'Building quadratic-rust-client...' && npm run build --workspace=quadratic-rust-client

# Build the quadratic-shared
WORKDIR /app
RUN echo 'Building quadratic-shared...' && npx tsc ./quadratic-shared/*.ts

# Build the front-end
WORKDIR /app
RUN echo 'Building front-end...'
ENV VITE_DEBUG=VITE_DEBUG_VAL
ENV VITE_QUADRATIC_API_URL=VITE_QUADRATIC_API_URL_VAL
ENV VITE_QUADRATIC_MULTIPLAYER_URL=VITE_QUADRATIC_MULTIPLAYER_URL_VAL
ENV VITE_QUADRATIC_CONNECTION_URL=VITE_QUADRATIC_CONNECTION_URL_VAL
ENV VITE_AUTH_TYPE=VITE_AUTH_TYPE_VAL
ENV VITE_ORY_HOST=VITE_ORY_HOST_VAL
RUN npm run build --workspace=quadratic-client

# The default command to run the application
# CMD ["npm", "run", "start:production"]

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80 443 3000

CMD ["nginx", "-g", "daemon off;"]







