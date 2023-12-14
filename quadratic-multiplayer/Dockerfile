# Use an official Rust runtime as a parent image
FROM rust:1.74.1

# Set the working directory in the container
WORKDIR /usr/src/quadratic-multiplayer

# Copy the manifest files first to cache dependencies
COPY quadratic-multiplayer/Cargo.toml quadratic-multiplayer/Cargo.lock ./
COPY quadratic-core/ ../quadratic-core/
COPY rust-shared/ ../rust-shared/
COPY quadratic-client/src/web-workers/rustWorker.ts ../quadratic-client/src/web-workers/rustWorker.ts

# Create a dummy project and build the project to cache dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build

# Copy the actual source code
COPY quadratic-core/ quadratic-core/
COPY quadratic-multiplayer/ .

# Compile the Rust app
RUN cargo build --release

# Make port 3001 available to the world outside this container
EXPOSE 3001

# Define environment variables
ENV HOST=0.0.0.0 \
    PORT=3001 \
    AUTH0_JWKS_URI='https://dev-nje7dw8s.us.auth0.com/.well-known/jwks.json' \
    AUTHENTICATE_JWT=false \
    HEARTBEAT_CHECK_S=15 \
    HEARTBEAT_TIMEOUT_S=60

# Run the binary program produced by `cargo build`
CMD ["./target/release/quadratic-multiplayer"]
