echo 'Installing rustup...'
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo 'Installing wasm-pack...'
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

echo 'Exporting TS/Rust types...'
cd quadratic-core
cargo run --bin export_types

echo 'Building wasm...'
wasm-pack build --target web --out-dir ../src/quadratic-core
wasm-pack build --target nodejs --out-dir ../src/quadratic-core/__mocks__
ls ../src/quadratic-core

echo 'Building front-end...'
cd ..
ls
npm run build