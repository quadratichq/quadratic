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

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM ubuntu:24.04 AS runtime

# Install runtime dependencies including Python and pip
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \  
  ca-certificates \
  python3 \
  python3-pip \
  python3-venv \
  libpython3.12 \
  && rm -rf /var/lib/apt/lists/*

# Install common Python packages that are frequently used in Quadratic
RUN pip3 install --break-system-packages \
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

CMD ["./quadratic-cloud-worker"]
