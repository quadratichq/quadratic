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

# Create a minimal workspace Cargo.toml with only needed members
RUN echo '[workspace]\n\
resolver = "2"\n\
members = [\n\
  "quadratic-rust-shared",\n\
  "quadratic-cloud-controller",\n\
]\n\
\n\
[workspace.package]\n\
authors = ["Quadratic"]\n\
edition = "2024"\n\
description = "Infinite data grid with Python, JavaScript, and SQL built-in"\n\
repository = "https://github.com/quadratichq/quadratic"\n\
license-file = "LICENSE"\n\
version = "0.20.8"\n\
\n\
[profile.release]\n\
opt-level = "s"' > Cargo.toml

COPY --link ./quadratic-rust-shared/. ./quadratic-rust-shared/
COPY --link ./quadratic-cloud-controller/. ./quadratic-cloud-controller/

WORKDIR /quadratic/quadratic-cloud-controller

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

COPY --from=builder /quadratic/target/release/quadratic-cloud-controller .

CMD ["./quadratic-cloud-controller"]
