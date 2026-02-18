###########################################################################################
# Builder
###########################################################################################
FROM rust:latest AS builder

# Install protobuf-compiler
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler

WORKDIR /quadratic

COPY ./quadratic-core-cloud/. ./quadratic-core-cloud/
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
COPY ./quadratic-rust-shared/. ./quadratic-rust-shared/

RUN rustup component add rustfmt

WORKDIR /quadratic/quadratic-core-cloud
COPY Cargo.lock .

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM debian:stable-slim AS runtime

# Install runtime dependencies including Python and Deno
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  ca-certificates \
  unzip \
  python3 \
  python3-venv \
  libpython3.12 \
  && rm -rf /var/lib/apt/lists/*

# Install Deno for JavaScript execution with full web API support (fetch, WebSocket, etc.)
RUN curl -fsSL https://deno.land/install.sh | sh && \
    /root/.deno/bin/deno --version

# Install uv - a fast Python package installer
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv && \
    mv /root/.local/bin/uvx /usr/local/bin/uvx && \
    uv --version

ENV PATH="/root/.deno/bin:${PATH}"

# Install common Python packages that are frequently used in Quadratic
RUN uv pip install --system --break-system-packages \
  pandas \
  numpy \
  matplotlib \
  seaborn \
  scipy \
  requests \
  openpyxl \
  xlsxwriter \
  plotly \
  scikit-learn \
  statsmodels \
  nltk \
  regex \
  faker

COPY --from=builder /quadratic/quadratic-core-cloud/target/release/quadratic-core-cloud .

CMD ["./quadratic-core-cloud"]