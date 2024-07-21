# Quadratic Connection Service

An Axum HTTP Server for processing the queries on remote data sources

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

### Health Checks

#### Request

```shell
curl http://127.0.0.1:3002/health -i
```

#### Response

```shell
HTTP/1.1 200 OK
content-length: 0
date: Mon, 08 Jan 2024 22:56:23 GMT
```