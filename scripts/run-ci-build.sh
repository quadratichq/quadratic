if [ "$VERCEL_ENV" == "preview" ]; then
  export REACT_APP_QUADRATIC_API_URL="https://quadratic-api-dev-pr-$VERCEL_GIT_PULL_REQUEST_ID.herokuapp.com"
  echo "On preview branch. Setting REACT_APP_QUADRATIC_API_URL to quadratic-api-dev-pr-$VERCEL_GIT_PULL_REQUEST_ID.herokuapp.com"
fi

echo 'Installing rustup...'
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo 'Installing wasm-pack...'
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

echo 'Building wasm...'
npm run build:wasm

echo 'Building front-end...'
npm run build
