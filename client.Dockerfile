# Use an official node image as a parent image
FROM node:18 AS build

# Install rustup
RUN echo 'Installing rustup...' && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install wasm-pack
RUN echo 'Installing wasm-pack...' && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Install python
RUN apt-get update || : && apt-get install python-is-python3 -y && apt install python3-pip -y

# Copy the rest of the application code
WORKDIR /app
COPY ./quadratic-kernels/python-wasm/. ./quadratic-kernels/python-wasm/

# Run the packaging script for quadratic_py
RUN ./quadratic-kernels/python-wasm/package.sh --no-poetry

# Build wasm
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/. ./quadratic-client/
WORKDIR /app/quadratic-core
RUN echo 'Building wasm...' &&  wasm-pack build --target web --out-dir ../quadratic-client/src/app/quadratic-core

# Export TS/Rust types
RUN echo 'Exporting TS/Rust types...' && cargo run --bin export_types

# Build the quadratic-rust-client
WORKDIR /app
RUN echo 'Building quadratic-rust-client...' && \
  npm run build --workspace=quadratic-rust-client

# Build the front-end
RUN echo 'Building front-end...' && \
  npm ci && \
  npm run build --workspace=quadratic-client

# The default command to run the application
CMD ["npm", "start"]
