###########################################################################################
# Builder
###########################################################################################
FROM ubuntu:24.04 AS builder

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  protobuf-compiler \
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

COPY ./quadratic-rust-shared/. ./quadratic-rust-shared/
COPY ./quadratic-connection/. ./quadratic-connection/

WORKDIR /quadratic/quadratic-connection

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM ubuntu:24.04 AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \  
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /quadratic/quadratic-connection/target/release/quadratic-connection .

CMD ["./quadratic-connection"]
