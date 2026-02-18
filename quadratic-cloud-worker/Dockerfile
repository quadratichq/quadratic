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
  llvm \
  clang \
  python3 \
  python3-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /quadratic

# Copy rust-toolchain file first so rustup can read it
COPY rust-toolchain.toml .

# Install rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Set up Rust environment
ENV PATH="/root/.cargo/bin:${PATH}"

# Trigger toolchain installation (this will read rust-toolchain.toml and install all components)
RUN rustup show

COPY ./quadratic-rust-shared/. ./quadratic-rust-shared/
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
COPY ./quadratic-core-cloud/. ./quadratic-core-cloud/
COPY ./quadratic-cloud-worker/. ./quadratic-cloud-worker/

WORKDIR /quadratic/quadratic-cloud-worker
COPY Cargo.lock .

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM ubuntu:24.04 AS runtime

# Install runtime dependencies including Python, Deno, and timezone data
# tzdata provides IANA timezone database needed for Deno/V8 to recognize timezone identifiers
# libicu74 provides ICU library used by V8 for internationalization including timezones
# The actual timezone is set dynamically by the controller via TZ environment variable
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  ca-certificates \
  unzip \
  python3 \
  python3-venv \
  libpython3.12 \
  tzdata \
  libicu74 \
  && rm -rf /var/lib/apt/lists/*

# Install Deno for JavaScript execution with full web API support (fetch, WebSocket, etc.)
RUN curl -fsSL https://deno.land/install.sh | sh && \
    /root/.deno/bin/deno --version

# Install uv - a fast Python package installer
# Install to /usr/local/bin instead of /root/.local/bin to avoid conflict with volume mount
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv && \
    mv /root/.local/bin/uvx /usr/local/bin/uvx && \
    uv --version

# Set up paths for Deno and Python
# Set PYTHONPATH to include /root/.local where user packages are installed
ENV PATH="/root/.deno/bin:${PATH}" \
    PYTHONPATH="/root/.local/lib/python3.12/site-packages"

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

COPY --from=builder /quadratic/quadratic-cloud-worker/target/release/quadratic-cloud-worker .
COPY quadratic-cloud-worker/entrypoint.sh .

RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
