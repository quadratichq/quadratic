# Quadratic Core

This contains the Rust code that powers Quadratic's client via WASM.

## Formula function documentation

Documentation for formula functions can be found in next to the Rust implementation of each function, in `src/formulas/functions/*.rs`. (`mod.rs` and `util.rs` do not contain any functions.)

### Rebuilding formula function documentation

Run `cargo run --bin docgen`, then copy/paste from `formula_docs_output.md` into Notion. Copying from VSCode will include formatting, so you may have to first paste it into a plaintext editor like Notepad, then copy/paste from there into Notion.

## Running benchmarks

### Pure Rust benchmark

To run benchmarks in pure compiled Rust, run `cargo bench`

### WASM benchmarks

We don't currently have WASM benchmarks working, but below are the steps we've tried in case you'd like to give it a try.

Setup:

1. `rustup target add wasm32-wasi`
2. `cargo build --bench=grid_benchmark --release --target wasm32-wasi`
3. `cp target/wasm32-wasi/release/deps/quadratic_core.wasm .`

To run in NodeJS:

1. `npm install -g @wasmer/cli`
2. `wasmer-js run --dir=. quadratic_core.wasm -- --bench`

To run in browser:

1. Go to <https://webassembly.sh/>
2. Drag `quadratic_core.wasm` into the browser window
3. In the browser, `quadratic_core --bench --export=base | download`

Neither of these seems to work. Nor does using a different generated WASM file, such as one with `grid_benchmark` in the name.

Instead of `cargo build`, it should be possible to build using `cargo-wasi`:

1. `cargo install cargo-wasi`
2. `cargo wasi build --bench=grid_benchmark --release`

But the build fails, probably for the same reason that there's an error when running the `.wasm` file through either of the other methods.

#### Things that help but don't fix everything

- Removing dependencies `rand` and `getrandom`
- Removing all uses `#[wasm_bindgen]`
