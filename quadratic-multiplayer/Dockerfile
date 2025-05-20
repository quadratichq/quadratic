###########################################################################################
# Builder
###########################################################################################
FROM rust:latest AS builder

# Install protobuf-compiler
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler

WORKDIR /quadratic

COPY ./quadratic-multiplayer/. ./quadratic-multiplayer/
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
COPY ./quadratic-rust-shared/. ./quadratic-rust-shared/

RUN rustup component add rustfmt

WORKDIR /quadratic/quadratic-multiplayer

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM debian:stable-slim AS runtime

COPY --from=builder /quadratic/quadratic-multiplayer/target/release/quadratic-multiplayer .

RUN apt-get update && apt install -y ca-certificates

CMD ["./quadratic-multiplayer"]
