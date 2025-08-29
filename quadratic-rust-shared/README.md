# Shared Rust Utilities

## Testing

You'll need to turn on features to run specific tests:

```rust
cargo watch -c -x "test websocket --features 'net' --lib -- --nocapture"
```