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

# Copy rust-toolchain first
COPY --link rust-toolchain.toml .

# Install rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Set up Rust environment
ENV PATH="/root/.cargo/bin:${PATH}"

# Trigger toolchain installation (this will read rust-toolchain.toml and install all components)
RUN rustup show

COPY --link ./quadratic-rust-shared/. ./quadratic-rust-shared/
COPY --link ./quadratic-cloud-controller/. ./quadratic-cloud-controller/

WORKDIR /quadratic/quadratic-cloud-controller
COPY Cargo.lock .

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM ubuntu:24.04 AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  ca-certificates \
  python3 \
  && rm -rf /var/lib/apt/lists/*

# Install uv - a fast Python package installer
# Install to /usr/local/bin instead of /root/.local/bin
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv && \
    mv /root/.local/bin/uvx /usr/local/bin/uvx && \
    uv --version

COPY --from=builder /quadratic/quadratic-cloud-controller/target/release/quadratic-cloud-controller .

CMD ["./quadratic-cloud-controller"]
