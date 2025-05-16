###########################################################################################
# Builder
###########################################################################################
FROM rust:latest AS builder

# Install protobuf-compiler
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler

WORKDIR /quadratic

COPY ./quadratic-files/. ./quadratic-files/
COPY ./quadratic-core/. ./quadratic-core/
COPY ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts ./quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts
COPY ./quadratic-rust-shared/. ./quadratic-rust-shared/

RUN rustup component add rustfmt

WORKDIR /quadratic/quadratic-files

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM debian:stable-slim AS runtime

COPY --from=builder /quadratic/quadratic-files/target/release/quadratic-files .

RUN apt-get update && apt install -y ca-certificates

CMD ["./quadratic-files"]