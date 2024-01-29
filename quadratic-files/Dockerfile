FROM rust:latest as builder

RUN USER=root cargo new --bin quadratic-files
COPY . /quadratic-files
RUN rustup component add rustfmt
WORKDIR /quadratic-files
RUN cargo build --release --package quadratic-files

FROM debian:stable-slim as runtime
COPY --from=builder /quadratic-files/target/release/quadratic-files .
RUN apt-get update && apt install -y ca-certificates
CMD ["./quadratic-files"]
