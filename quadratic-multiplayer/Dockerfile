FROM rust:latest as builder

RUN USER=root cargo new --bin quadratic-multiplayer
COPY . /quadratic-multiplayer
RUN rustup component add rustfmt
WORKDIR /quadratic-multiplayer
RUN cargo build --release --package quadratic-multiplayer

FROM debian:stable-slim as runtime
COPY --from=builder /quadratic-multiplayer/target/release/quadratic-multiplayer .
RUN apt-get update && apt install -y ca-certificates
CMD ["./quadratic-multiplayer"]
