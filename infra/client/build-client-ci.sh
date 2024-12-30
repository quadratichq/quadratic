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

echo 'Installing wasm32-unknown-unknown target...'
rustup target add wasm32-unknown-unknown

# Start parallel builds
(
  # Task 1: Install dependencies
  (
    echo 'Installing dependencies...'
    npm ci
  ) &

  # Task 2: Build core
  (
    echo 'Building core...'
    npm run build --workspace=quadratic-core -- --frozen
  ) &

  # Task 3: Build TS/Rust types
  (
    echo 'Building TS/Rust types...'
    npm run export_types --workspace=quadratic-core -- --frozen
  ) &

  # Task 4: Build rust client
  (
    echo 'Building rust-client...'
    npm run build --workspace=quadratic-rust-client -- --frozen
  ) &

  # Wait for all background tasks to complete
  wait
)

echo 'Packaging quadratic_py'
./quadratic-kernels/python-wasm/package.sh --no-poetry

echo 'Building front-end...'
npm run build --workspace=quadratic-client
