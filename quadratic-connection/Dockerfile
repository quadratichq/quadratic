###########################################################################################
# Builder
###########################################################################################
FROM rust:latest AS builder

# Install protobuf-compiler
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler

WORKDIR /quadratic

COPY ./quadratic-connection/. ./quadratic-connection/
COPY ./quadratic-rust-shared/. ./quadratic-rust-shared/

RUN rustup component add rustfmt

WORKDIR /quadratic/quadratic-connection

RUN cargo build --release


###########################################################################################
# Runner
###########################################################################################
FROM debian:stable-slim AS runtime

COPY --from=builder /quadratic/quadratic-connection/target/release/quadratic-connection .

RUN apt-get update && apt install -y ca-certificates

CMD ["./quadratic-connection"]
