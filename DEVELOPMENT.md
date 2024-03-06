<!-- omit in toc -->
# Development

Let's get everything setup to develop on Quadratic!

- [Install Dependencies](#install-dependencies)
- [Local Environment Setup](#local-environment-setup)
  - [Docker](#docker)
    - [Docker Compose](#docker-compose)
    - [Building Images Manually](#building-images-manually)
  - [Developing without Docker](#developing-without-docker)
    - [Installing PostgreSQL](#installing-postgresql)
      - [Mac](#mac)
      - [Create Database](#create-database)
    - [Installing Redis](#installing-redis)
      - [Mac](#mac-1)
- [Using node dev](#using-node-dev)
  - [Commands while `node dev` is running](#commands-while-node-dev-is-running)
  - [Running for React-only development](#running-for-react-only-development)
- [Testing](#testing)
  - [Testing Quadratic Client](#testing-quadratic-client)
  - [Testing Quadratic API](#testing-quadratic-api)
  - [Testing Rust Crates](#testing-rust-crates)
    - [Rust Coverage](#rust-coverage)
- [Linting](#linting)
  - [Linting Rust Crates](#linting-rust-crates)
- [Load Testing](#load-testing)


## Install Dependencies

First, follow the instructions to install:

1. [NVM](https://github.com/nvm-sh/nvm)
1. [rustup](https://www.rust-lang.org/tools/install)
1. [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
1. [Docker Desktop](https://docs.docker.com/desktop/)

Start Docker Desktop after installing required software.  Now install the depedencies:

```shell
# install node version 18
nvm install 18

#install the WASM toolchain
rustup target add wasm32-unknown-unknown

# install cargo watch
cargo install cargo-watch
```

## Local Environment Setup

Now that dependencies are installed, all you need to do is run `node dev` to 
bring up the all services.  Invoke `node run --help` for information on how
to use this script, as you can use it to watch individual (or groups of)
services during development. See the [Using node dev](Using-node-dev) section
for more more information.

### Docker

#### Docker Compose

Docker Compose is a utility that's built into Docker Desktop and is a compact 
infrastructure-as-code framework.  Services (e.g. running Docker containers) are
defined, along with configuration information, in the `docker-compose.yml` file.
Services can talk to each other and can communicate with services in the user's host
network.

To pull up the Docker network with just the required depedencies (Redis, Postgres, Localstack):

```shell
npm run docker:up
```

Along with the dependent services, scripts are executed that create S3 buckets and
migrate the database.  Docker is run in the background in this script.



#### Building Images Manually

To build images for individual services (from project root):

```shell
docker-compose build quadratic-api
docker-compose build quadratic-files
docker-compose build quadratic-multiplayer
```

### Developing without Docker

You can also develop Quadratic without using docker

* Set up .env in quadratic-client, quadratic-api, quadratic-multiplayer, and quadratic-files. (todo: better description of how to do this)

#### Installing PostgreSQL

##### Mac

`brew install postgresql` (Mac)
`brew services start postgresql`

##### Create Database

* Create a database for use with postgres
* Add database to quadratic-api/.env

#### Installing Redis

##### Mac

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

## Testing

### Testing Quadratic Client

To test quadratic-client, enter the following command from the root of the project:

```shell
npm run test:ts
```

### Testing Quadratic API

To test quadratic-api, close the existing docker network (`npm run docker:down`), and enter the following command from the root of the project:

```shell
npm run test:api
```

### Testing Rust Crates

To test an individual crate, bring up the docker network (`npm run docker:up`) and navigate to the root of the crate and enter:

```shell
cargo test

# npm alternative
npm run test

# watcher
RUST_LOG=info cargo watch -x 'test'

# npm alternative
npm run test:watch
```

Alternatively, to run all rust test, simply enter `cargo test` at the project root.

See the README in each crate for more information.

#### Rust Coverage

In CI, coverage is automatically collected and sent to CodeCov.  

For local coverage information, you'll need to install some dependencies first:


```shell
cargo install grcov
rustup component add llvm-tools-preview
```

To run coverage and generate HTML reports, bring up the docker network 
(`npm run docker:up`) and navigate to the individual crate and enter:

```shell
npm run coverage
```

Coverage infomration will be available in the generated `coverage` folder located at `coverage/html/index.html`.

## Linting

### Linting Rust Crates

To lint an individual crate, navigate to the root of the crate and enter:

```shell
cargo clippy --all-targets --all-features -- -D warnings

# npm alternative
npm run lint
```

Alternatively, to run all rust test, simply enter `cargo clippy --all-targets --all-features -- -D warnings` at the project root.

## Load Testing

Local load testing is performed by [JMeter](https://jmeter.apache.org/).  First, install JMeter by either [downloading it it](https://jmeter.apache.org/download_jmeter.cgi) or installing via your favorite package manager (e.g. brew):

```shell
brew install jmeter
```

Load tests are located in the `/tests/load` directory.  Run run jmeter: 

```shell
bash jmeter

# or for some
bash /opt/homebrew/Cellar/jmeter/5.6.3/bin/jmeter
```

Select `file -> open` and navigate to the `/tests/load` directory and pick a load test file to edit.  See the [user manual](https://jmeter.apache.org/usermanual/index.html) for more information.

To run a jmter test, bring up all relevant services and invoke:

```
bash jmeter  -n -t PATH_TO_JMX_FILE

# alternative if you're having issues locating your JDK
JAVA_HOME="/opt/homebrew/opt/openjdk" bash /opt/homebrew/Cellar/jmeter/5.6.3/libexec/bin/jmeter -n -t test/load/load-test-quadratic-multiplayer.jmx
```

Output will be located in the terminal.