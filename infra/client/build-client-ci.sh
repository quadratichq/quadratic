set -euo pipefail

# Setting env vars this way will only work on Vercel
# AWS_PULL_REQUEST_ID is set on Amplify
if [ "$VERCEL_ENV" == "preview" ]; then
  export VITE_QUADRATIC_API_URL="https://quadratic-api-dev-pr-$VERCEL_GIT_PULL_REQUEST_ID.herokuapp.com"
  echo "On preview branch. Setting VITE_QUADRATIC_API_URL to quadratic-api-dev-pr-$VERCEL_GIT_PULL_REQUEST_ID.herokuapp.com"
  export VITE_QUADRATIC_MULTIPLAYER_URL="wss://multiplayer-pr-$VERCEL_GIT_PULL_REQUEST_ID.quadratic-preview.com/ws"
  echo "On preview branch. Setting VITE_QUADRATIC_MULTIPLAYER_URL to wss://multiplayer-pr-$VERCEL_GIT_PULL_REQUEST_ID.quadratic-preview.com/ws"
  export VITE_QUADRATIC_CONNECTION_URL="https://connection-pr-$VERCEL_GIT_PULL_REQUEST_ID.quadratic-preview.com"
  echo "On preview branch. Setting VITE_QUADRATIC_CONNECTION_URL to https://connector-pr-$VERCEL_GIT_PULL_REQUEST_ID.quadratic-preview.com"
fi

# These commands are used in production on AWS Amplify

echo 'Installing rustup...'
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo 'Installing wasm-pack...'
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

echo 'Packaging quadratic_py'
./quadratic-kernels/python-wasm/package.sh --no-poetry

cd quadratic-core

echo 'Building wasm...'
wasm-pack build --target web --out-dir ../quadratic-client/src/app/quadratic-core

echo 'Exporting TS/Rust types...'
cargo run --bin export_types

cd ..

echo 'Building quadratic-rust-client...'
npm run build --workspace=quadratic-rust-client

echo 'Building front-end...'
npm ci --no-audit --no-fund
npm run build --workspace=quadratic-client

# Install compression tools
echo 'Installing compression tools...'
apt-get update && apt-get install -y brotli pigz

# Compress files
find "/build" -type f \( \
  -name "*.js" -o \
  -name "*.mjs" -o \
  -name "*.cjs" -o \
  -name "*.jsx" -o \
  -name "*.ts" -o \
  -name "*.tsx" -o \
  -name "*.wasm" -o \
  -name "*.whl" -o \
  -name "*.json" -o \
  -name "*.css" -o \
  -name "*.html" -o \
  -name "*.svg" -o \
  -name "*.txt" -o \
  -name "*.map" -o \
  -name "*.py" -o \
  -name "*.pyc" -o \
  -name "*.pyi" -o \
  -name "*.pth" -o \
  -name "*.data" -o \
  -name "*.mem" -o \
  -name "*.wat" -o \
  -name "*.md" -o \
  -name "*.rst" -o \
  -name "*.rtf" -o \
  -name "*.csv" -o \
  -name "*.tsv" -o \
  -name "*.eot" -o \
  -name "*.ttf" -o \
  -name "*.otf" -o \
  -name "*.woff" -o \
  -name "*.woff2" -o \
  -name "*.font" -o \
  -name "*.font-sfnt" \
\) -print0 | xargs -0 -n1 -P$(nproc) -I {} sh -c '\
  echo "Compressing: {}" && \
  brotli -q 9 -w 24 -f "{}" && \
  pigz -6kf "{}" && \
  echo "Created: {}.br and {}.gz" \
'
