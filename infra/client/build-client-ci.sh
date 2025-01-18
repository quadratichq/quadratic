set -euo pipefail

# These commands are used in production on AWS Amplify

echo 'Installing build-essential, llvm, and clang...'
apt-get update && apt-get install -y --no-install-recommends build-essential llvm clang
export CC=clang
export AR=llvm-ar

echo 'Installing rustup...'
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo 'Installing wasm-pack...'
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh -s -- -y

echo 'Installing wasm32-unknown-unknown target...'
rustup target add wasm32-unknown-unknown

echo 'Packaging quadratic_py'
./quadratic-kernels/python-wasm/package.sh --no-poetry

echo 'Starting parallel rust builds...'
(echo 'Building core...' && npm run build --workspace=quadratic-core) & \
(echo 'Building TS/Rust types...' && npm run export_types --workspace=quadratic-core) & \
(echo 'Building rust-client...' && npm run build --workspace=quadratic-rust-client) & \
wait

echo 'Building front-end...'
npm ci --no-audit --no-fund
npm run build --workspace=quadratic-client
