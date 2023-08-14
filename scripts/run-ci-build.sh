echo 'Installing rustup...'
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo 'Installing wasm-pack...'
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

cd quadratic-core

echo 'Building wasm...'
wasm-pack build --target web --out-dir ../src/quadratic-core

echo 'Exporting TS/Rust types...'
cargo run --bin export_types

cd ..

echo 'Building front-end...'
npm run build