<!-- omit in toc -->
# Development

Let's get everything setup to develop on Quadratic!

- [Install Dependencies](#install-dependencies)
- [Docker Compose](#docker-compose)
- [Develop on the Frontend](#develop-on-the-frontend)
- [Develop on Quadratic API](#develop-on-quadratic-api)
- [Develop on Quadratic Core](#develop-on-quadratic-core)
- [Develop on Quadratic MultiPlayer](#develop-on-quadratic-multiplayer)
- [Develop on Quadratic Files](#develop-on-quadratic-files)


## Install Dependencies

First, follow the instructions to install: 

1. [NVM](https://github.com/nvm-sh/nvm)
1. [rustup](https://www.rust-lang.org/tools/install)
1. [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
1. [Docker Desktop](https://docs.docker.com/desktop/)

Start Docker Desktop after installing.  Now install the depedencies:

```shell
# install node version 18
nvm install 18

#install the WASM toolchain
rustup target add wasm32-unknown-unknown

# install cargo watch
cargo install cargo-watch
```

## Docker Compose

To build images for individual services (from project root):

```shell
docker-compose build quadratic-api
docker-compose build quadratic-files
docker-compose build quadratic-multiplayer
```


To pull up the network with just the required depedencies (Redis, Postgres, Localstack):

```shell
docker compose up
```

To run the network in the background, add the `-d` command to the end: 

```shell
docker compose up -d
```

## Develop on the Frontend

## Develop on Quadratic API

## Develop on Quadratic Core

## Develop on Quadratic MultiPlayer

## Develop on Quadratic Files