###########################################################################################
# Builder
###########################################################################################
FROM ubuntu:24.04 AS builder

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  protobuf-compiler \
  libprotobuf-dev \
  curl \
  ca-certificates \
  pkg-config \
  libssl-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /quadratic

# Copy rust-toolchain file first so rustup can read it
COPY --link rust-toolchain.toml .

# Install rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Set up Rust environment
ENV PATH="/root/.cargo/bin:${PATH}"

# Trigger toolchain installation (this will read rust-toolchain.toml and install all components)
RUN rustup show

COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
COPY ./quadratic-rust-shared/. ./quadratic-rust-shared/
COPY ./quadratic-files/. ./quadratic-files/

WORKDIR /quadratic/quadratic-files
COPY Cargo.lock .

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM ubuntu:24.04 AS runtime

COPY --from=builder /quadratic/quadratic-files/target/release/quadratic-files .

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

CMD ["./quadratic-files"]