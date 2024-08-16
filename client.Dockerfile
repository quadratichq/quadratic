# Use an official node image as a parent image
FROM node:18 AS build

# Install rustup
RUN echo 'Installing rustup...' && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install wasm-pack
RUN echo 'Installing wasm-pack...' && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Install python
RUN apt-get update || : && apt-get install python-is-python3 -y && apt install python3-pip -y

# Install binaryen
RUN apt install binaryen -y

# Copy the rest of the application code
WORKDIR /app

COPY package.json .
COPY package-lock.json .
COPY updateAlertVersion.json .
COPY ./quadratic-client/. ./quadratic-client/
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-kernels/python-wasm/. ./quadratic-kernels/python-wasm/
COPY ./quadratic-rust-client/. ./quadratic-rust-client/
COPY ./quadratic-shared/. ./quadratic-shared/

# Run the packaging script for quadratic_py
RUN ./quadratic-kernels/python-wasm/package.sh --no-poetry

# Build wasm
WORKDIR /app/quadratic-core
RUN rustup target add wasm32-unknown-unknown
RUN echo 'Building wasm...' &&  wasm-pack build --target web --out-dir ../quadratic-client/src/app/quadratic-core --weak-refs

# Export TS/Rust types
RUN echo 'Exporting TS/Rust types...' && cargo run --bin export_types

# Build the quadratic-rust-client
WORKDIR /app
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT
RUN echo 'Building quadratic-rust-client...' && npm run build --workspace=quadratic-rust-client

# Build the front-end
WORKDIR /app
RUN echo 'Building front-end...'
RUN npm ci
RUN npm install typescript
RUN npx tsc ./quadratic-shared/*.ts
RUN npm run build --workspace=quadratic-client

# The default command to run the application
# CMD ["npm", "run", "start:production"]

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]