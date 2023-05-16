# Quadratic Core

This contains the Rust code that powers Quadratic's client via WASM.

## Formula function documentation

Documentation for formula functions can be found in next to the Rust implementation of each function, in `src/formulas/functions/*.rs`. (`mod.rs` and `util.rs` do not contain any functions.)

### Rebuilding formula function documentation

Run `cargo run --bin docgen`, then copy/paste from `formula_docs_output.md` into Notion. Copying from VSCode will include formatting, so you may have to first paste it into a plaintext editor like Notepad, then copy/paste from there into Notion.
