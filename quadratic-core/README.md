# Quadratic Core

This contains the Rust code that powers Quadratic's client via WASM.

## Formula function documentation

Documentation for formula functions can be found in next to the Rust implementation of each function, in `src/formulas/functions/*.rs`. (`mod.rs` and `util.rs` do not contain any functions.)

### Rebuilding formula function documentation

Run `cargo run --bin docgen`, then copy/paste from `formula_docs_output.md` into Notion. Copying from VSCode will include formatting, so you may have to first paste it into a plaintext editor like Notepad, then copy/paste from there into Notion.

## Code Coverage

Code coverage tooling has been added to the npm scripts.  Before running, install dependencies:

```shell
cargo install grcov
rustup component add llvm-tools-preview
```

To generate the LLVM profraw files, run the following from the root:

```shell
npm run coverage:wasm:gen
```

Once the profraw files are generated, you can generate and view HTML by running the following from the root:

```shell
npm run coverage:wasm:html
npm run coverage:wasm:view
```

## Running benchmarks

### Pure Rust benchmark

To run benchmarks in pure compiled Rust, run `cargo bench`

### WASM benchmarks

1. `rustup target add wasm32-wasi`
2. `cargo install cargo-wasi`
3. `cargo wasi build --bench=grid_benchmark --release --no-default-features`
4. ``cp target/wasm32-wasi/release/deps/grid_benchmark-*.wasm .``
5. `ls`
6. There should be three WASM files (perhaps more if you have done prior builds). Ignore the ones with `.rustc.wasm` and `.wasi.wasm`. Rename the remaining `.wasm` file to `benchmark.wasm`.

We include `--no-default-features` specifically to disable the `js` feature of `quadratic-core`, because the benchmark suite uses only WASI APIs and cannot depend on JS.

To run in NodeJS:

1. `npm install -g @wasmer/cli`
2. `wasmer-js run --dir=. benchmark.wasm -- --bench`

To run in browser:

1. Go to <https://webassembly.sh/>
2. Drag `benchmark.wasm` into the browser window
3. In the browser, `benchmark --bench | download`
