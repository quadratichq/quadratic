FROM rust:latest as builder

RUN USER=root cargo new --bin quadratic-connector
COPY . /quadratic-connector
RUN rustup component add rustfmt
WORKDIR /quadratic-connector
RUN cargo build --release --package quadratic-connector

FROM debian:stable-slim as runtime
COPY --from=builder /quadratic-connector/target/release/quadratic-connector .
RUN apt-get update && apt install -y ca-certificates
CMD ["./quadratic-connector"]
