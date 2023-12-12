
# Setting env vars this way will only work on Vercel
# AWS_PULL_REQUEST_ID is set on Amplify
if [ "$VERCEL_ENV" == "preview" ]; then
  export VITE_QUADRATIC_API_URL="https://quadratic-api-dev-pr-$VERCEL_GIT_PULL_REQUEST_ID.herokuapp.com"
  echo "On preview branch. Setting VITE_QUADRATIC_API_URL to quadratic-api-dev-pr-$VERCEL_GIT_PULL_REQUEST_ID.herokuapp.com"
  export VITE_QUADRATIC_MULTIPLAYER_URL="wss://multiplayer-pr-$VERCEL_GIT_PULL_REQUEST_ID.quadratic-preview.com/ws"
  echo "On preview branch. Setting VITE_QUADRATIC_MULTIPLAYER_URL to wss://multiplayer-pr-$VERCEL_GIT_PULL_REQUEST_ID.quadratic-preview.com/ws"
fi

# These commands are used in production on AWS Amplify

echo 'Installing rustup...'
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo 'Installing wasm-pack...'
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

cd quadratic-core

echo 'Building wasm...'
wasm-pack build --target web --out-dir ../quadratic-client/src/quadratic-core

echo 'Exporting TS/Rust types...'
cargo run --bin export_types

echo 'Building front-end...'
npm ci
npm run build --workspace=quadratic-client
