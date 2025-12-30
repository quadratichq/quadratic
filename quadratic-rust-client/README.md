# quadratic-rust-client

Rust client for Quadratic, built for WASM.

## Building

```bash
# Development build
wasm-pack build --dev --target web --out-dir pkg

# Release build
wasm-pack build --target web --out-dir pkg
```

## Testing

```bash
wasm-pack test --headless --chrome
```
