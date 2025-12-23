# Quadratic Core Cloud

Process Quadratic Core transactions in the cloud. Executes Python and JavaScript code cells via worker processes.


## Development

### Prerequisites

- Deno must be installed locally for JavaScript execution: `npm run install:deno`

To develop with the watcher enabled:

```shell
RUST_LOG=info cargo watch -x 'run'

// npm alternative
npm run dev
```

### Testing

To develop with the watcher enabled:

```shell
cargo test

// npm alternative
npm run test

// watcher
RUST_LOG=info cargo watch -x 'test'

// npm alternative
npm run test:watch
```

### Linting

To develop with the watcher enabled:

```shell
cargo clippy --all-targets --all-features -- -D warnings

// npm alternative
npm run lint
```

