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
    - [Commands while `node dev` is running](#commands-while-node-dev-is-running)
    - [Running for React-only development](#running-for-react-only-development)


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

Call `node dev` from the /quadratic directory. This script handles fixing most common problems. You do need to ensure your system is properly set up with the correct `.env` files and the database and redis setup and available.

```
Usage: node dev [options]

Runs the Quadratic dev server. By default, only React runs in watch mode.

Options:
  -a, --api              Watch the quadratic-api directory
  -c, --core             Watch the quadratic-core directory
  -m, --multiplayer      Watch the quadratic-multiplayer directory
  -f, --files            Watch the quadratic-files directory
  -a, --all              Watch all directories
  -s, --skipTypes        Skip WASM types compilation
  -p, --perf             Run quadratic-core in perf mode (slower to link but faster runtime)
  -R, --hideReact        Hide React output
  -A, --hideAPI          Hide React output
  -C, --hideCore         Hide React output
  -T, --hideTypes        Hide Types output
  -M, --hideMultiplayer  Hide Multiplayer output
  -F, --hideFiles        Hide Files output
  -d, --dark             Use dark theme
  -h, --help             display help for command
```

### Commands while `node dev` is running

Press `h` while running to see this help menu. Press `H` while running to see the CLI commands.

```
Press:
     a c   m f - Toggle watch for component
   R A C T M F - Toggle showing logs for component
             p - Toggle performance build for Core
             r - Restart React
             t - Rebuild WASM types from Core for React
             d - Toggle dark theme
             H - Show CLI options
```

### Running for React-only development

After you successfully run the app the first time, use `node dev -ACTMF` if only developing in React. This will hide output from Rust and server components.