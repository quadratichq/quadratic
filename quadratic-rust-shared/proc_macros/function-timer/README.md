# Function Timer

This is a proc macro that times the execution of a function.

```rust
#[function_timer::function_timer]
fn test_function_timer() {
    for _ in 0..2 {
        sleep(Duration::from_millis(10));
    }
}
```

In order to print the output, you need to pass the `dbgjs` attribute to the macro.

```rust
#[function_timer::function_timer(dbgjs)]
fn test_function_timer() {
    for _ in 0..2 {
        sleep(Duration::from_millis(10));
    }
}
```

## Development

```bash
cargo watch -c -w src -x "test --lib -- --nocapture"
```

## Test

```bash
cargo test --lib
```
