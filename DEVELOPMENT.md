<!-- omit in toc -->
# Development

Let's get everything setup to develop on Quadratic!

- [Developing without Docker](#developing-without-docker)
  - [Installing PostgreSQL](#installing-postgresql)
    - [Mac](#mac)
    - [Create Database](#create-database)
  - [Installing Redis](#installing-redis)
    - [Mac](#mac-1)
  - [Using node dev](#using-node-dev)
    - [Development](#development-1)
    - [Develop on the Frontend](#develop-on-the-frontend-1)
    - [Develop on Quadratic API](#develop-on-quadratic-api-1)
    - [Develop on Quadratic Core](#develop-on-quadratic-core-1)
    - [Develop on Quadratic MultiPlayer](#develop-on-quadratic-multiplayer-1)
    - [Develop on Quadratic Files](#develop-on-quadratic-files-1)


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

# Developing without Docker

You can also develop Quadratic without using docker

- [Install Dependencies](#install-dependencies)
- Set up .env in quadratic-client, quadratic-api, quadratic-multiplayer, and quadratic-files. (todo: better description of how to do this)

## Installing PostgreSQL

### Mac

`brew install postgresql` (Mac)
`brew services start postgresql`

### Create Database

- Create a database for use with postgres
- Add database to quadratic-api/.env

## Installing Redis

### Mac

`brew install redis`
`brew services start redis`

## Using node dev

Call `node dev` from the /quadratic directory.

```
Usage: node dev [options]

Runs the Quadratic dev server. By default, only React runs in watch mode.

Options:
  -p, --api          Watch the quadratic-api directory
  -c, --core         Watch the quadratic-core directory
  -m, --multiplayer  Watch the quadratic-multiplayer directory
  -f, --files        Watch the quadratic-files directory
  -s, --skipTypes    Skip WASM types compilation
  -a, --all          Watch all directories
  -p, --perf         Run quadratic-core in perf mode (slower linking but faster runtime)
  -h, --help         display help for command
  ```

### Development

Use any combination of flags based on the components you are developing. This has the advantage of not recompiling rust components that should not be impacted by your work. For example, if you're only working on Core, your changes may force multiplayer and files to recompile. But if those should not be impacted, then it's better not to run those components in watch mode.

`--skipTypes`` is useful to skip running the WASM type generator when first starting the script. This will speed up the start of the script.

`--perf`` is useful to experience the app w/Rust running at full production speed. Core normally runs with --dev on, which significantly impacts performance.

### Develop on the Frontend

If you are only working on the react front-end, you can run `node dev` without any options.

### Develop on Quadratic API

Use `node dev -p` if you are developing the API. Only React and the API will be in watch mode.

### Develop on Quadratic Core

Use `node dev -c` if you are developing Core. Only React and Core will be in watch mode.

### Develop on Quadratic MultiPlayer

Use `node dev -m` if you are developing Multiplayer. Only React and the Multiplayer server will be in watch mode.

### Develop on Quadratic Files

Use `node dev -f` if you are developing Files. Only React and the Multiplayer server will be in watch mode.
