FROM rust:latest AS builder

WORKDIR /quadratic
COPY ./quadratic-connection/. ./quadratic-connection/
COPY ./quadratic-rust-shared/. ./quadratic-rust-shared/
RUN rustup component add rustfmt

WORKDIR /quadratic/quadratic-connection
RUN cargo build --release

FROM debian:stable-slim AS runtime
COPY --from=builder /quadratic/quadratic-connection/target/release/quadratic-connection .
RUN apt-get update && apt install -y ca-certificates
CMD ["./quadratic-connection"]
