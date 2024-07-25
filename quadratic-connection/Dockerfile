FROM rust:latest as builder

RUN USER=root cargo new --bin quadratic-connection
COPY . /quadratic-connection
RUN rustup component add rustfmt
WORKDIR /quadratic-connection
RUN cargo build --release --package quadratic-connection

FROM debian:stable-slim as runtime
COPY --from=builder /quadratic-connection/target/release/quadratic-connection .
RUN apt-get update && apt install -y ca-certificates
CMD ["./quadratic-connection"]
