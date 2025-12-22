# Quadratic Cloud Controller

Orchestrates cloud workers for file processing tasks. Manages worker lifecycle, task distribution, and health monitoring.

## Architecture

- **Public server**: Health checks, JWKS endpoint
- **Worker-only server**: Task distribution, worker shutdown, task acknowledgment
- **Background workers**: Redis pub/sub, task scheduling, worker cleanup

## Features

- `docker` (default): Docker-based worker orchestration
- `kubernetes`: K8s-based orchestration (WIP)

## Config

Copy the example environment variables:

```bash
cp .env.example .env
```

Then edit the values as needed.

## Build

```bash
cargo build --release
```

## Run

```bash
cargo run
```

## Docker

```bash
docker build -t quadratic-cloud-controller .
docker run quadratic-cloud-controller
```
