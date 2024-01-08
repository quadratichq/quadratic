# Quadratic File Service

An Axum HTTP Server for processing the file queue.

## Running

First, copy over the environment variables (customize if applicable):

```shell
cp .env.example .env
```

To run the server:

```shell
RUST_LOG=info cargo run

// npm alternative
npm start
```


## Development

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

## API