# Development

Let's get everything setup to develop on Quadratic!

## Install Dependencies

First, install base dependencies:

1. [NVM](https://github.com/nvm-sh/nvm)
2. [rustup](https://www.rust-lang.org/tools/install)
3. [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
4. [Docker Desktop](https://docs.docker.com/desktop/)
5. [Python3] (should be preinstalled on mac)

Start the Docker Desktop by opening Docker.

`open -a Docker`

Now install the tool chain:

```shell
# install node
nvm install

#install the WASM toolchain
rustup target add wasm32-unknown-unknown

# install cargo watch
cargo install cargo-watch
```

Download pyodide
`npm run client:download:pyodide`

## Local Environment Setup

1. Create .env files using the template .env.example files

   ```sh
    cp .env.example .env && \
    cp quadratic-api/.env.example quadratic-api/.env && \
    cp quadratic-client/.env.example quadratic-client/.env && \
    cp quadratic-files/.env.example quadratic-files/.env && \
    cp quadratic-multiplayer/.env.example quadratic-multiplayer/.env && \
    cp quadratic-connection/.env.example quadratic-connection/.env
   ```

These are prefilled with `quadratic-community` Auth0 account credentials and values required to access services in docker.

If you are on the Quadratic team you can get AUTH0 credentials from Notion.
Auth0 creds need to be updated in: API, Client, Multiplayer, and Connections.

## Start Docker

Keep this running in a tab
`npm run docker:base`
or
`npm run docker:base -- -d`
to run as a daemon

## Start Quadratic Dev

In a new terminal tab
`npm start`

Now that dependencies are installed, all you need to do is run `npm start` which runs `node dev` to
bring up the all services. Invoke `node run --help` for information on how
to use this script, as you can use it to watch individual (or groups of)
services during development. See the [Using node dev](Using-node-dev) section
for more more information.

# Additional Information for Development

### Docker

#### Docker Compose

Docker Compose is a utility that's built into Docker Desktop and is a compact
infrastructure-as-code framework. Services (e.g. running Docker containers) are
defined, along with configuration information, in the `docker compose.yml` file.
Services can talk to each other and can communicate with services in the user's host
network.

To pull up the Docker network with just the required dependencies (Redis, Postgres, Localstack):

```shell
npm run docker:up
```

Along with the dependent services, scripts are executed that create S3 buckets and
migrate the database. Docker is run in the background in this script.

#### Building Images Manually

To build images for individual services (from project root):

```shell
docker compose build quadratic-api
docker compose build quadratic-files
docker compose build quadratic-multiplayer
```

### Developing without Docker

You can also develop Quadratic without using docker

- Set up .env in quadratic-client, quadratic-api, quadratic-multiplayer, and quadratic-files.

```shell
cp .env.example .env.local
cp quadratic-client/.env_example quadratic-client/.env.local
cp quadratic-api/.env_example quadratic-api/.env
cp quadratic-multiplayer/.env.example quadratic-multiplayer/.env
cp quadratic-files/.env.example quadratic-files/.env
```

#### Installing PostgreSQL

##### Mac

`brew install postgresql` (Mac)
`brew services start postgresql`

##### Create Database

- Create a database for use with postgres
- Add database to quadratic-api/.env

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

Coverage information will be available in the generated `coverage` folder located at `coverage/html/index.html`.

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

Local load testing is performed by [JMeter](https://jmeter.apache.org/). First, install JMeter by either [downloading it it](https://jmeter.apache.org/download_jmeter.cgi) or installing via your favorite package manager (e.g. brew):

```shell
brew install jmeter
```

Load tests are located in the `/tests/load` directory. Run run jmeter:

```shell
bash jmeter

# or for some
bash /opt/homebrew/Cellar/jmeter/5.6.3/bin/jmeter
```

Select `file -> open` and navigate to the `/tests/load` directory and pick a load test file to edit. See the [user manual](https://jmeter.apache.org/usermanual/index.html) for more information.

To run a jmter test, bring up all relevant services and invoke:

```
bash jmeter  -n -t PATH_TO_JMX_FILE

# alternative if you're having issues locating your JDK
JAVA_HOME="/opt/homebrew/opt/openjdk" bash /opt/homebrew/Cellar/jmeter/5.6.3/libexec/bin/jmeter -n -t test/load/load-test-quadratic-multiplayer.jmx
```

Output will be located in the terminal.

## Prompting user after version change

Versioning is handled by client and the multiplayer server based on the bump script and the /quadratic-client/public/version.json file.

### Configure Auth0 account (Optional)

This is only required if the `quadratic-community` Auth0 account does not work.

1. Create an account on [Auth0](https://auth0.com/)

2. Create a new Regular Web Application

3. In the settings tab, configure the following:
   - Allowed Callback URLs: `http://localhost:3000/login-result?redirectTo`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
   - Allowed Origins (CORS): `http://localhost:3000`

## How to Add AI Tools

1. run `node dev -cas` - you need at least API and Shared to recompile (and probably need core, as there may need to be changes)

2. update `quadraticShared/../aiToolsSpec.ts` for the new tool:
   - AITool enum (the name of the tool)
   - AIToolSchema (list of tools)
   - AIToolsArgsSchema (the zod parameters)
   - aiToolsSpec (the actual tool and prompt definition)

3. create a ToolCard in `quadraticClient/../toolCards/`

4. add new ToolCard to `quadraticClient/../AIToolCard.tsx`

5. add the action to `quadraticClient/../aiToolsActions.ts`

Note: you may need to restart node dev occasionally if it doesn't pick up your changes.

## E2E Testing

### Install Prerequisites

Use Node 24 and install dependencies:

```bash
cd tests/e2e
nvm use 24
npm i
npx playwright install-deps
npx playwright install
```

### Running Tests

1. All machines types to locally run E2E tests from /quadratic/test/e2e/:
   * `npm run test` to run all tests
   * `npm run test:ui` to open UI that runs tests
   * (Only Linux): `npm run test:update` will update images--normally, you will use test.only(...) in front of the desired test so you only update that test
2. To generate images on Mac or Windows, run e2e /quadratic:
   * `npm run test` will run all tests in docker
   * `npm run test:update` will update screenshots in tests, similar to above (use test.only to limit the updates)

### Linux Instructions on a Mac

1. Install Operating System: Playwright supports Ubuntu LTS releases 22.04 and 24.04.
1. Install and setup SSH: Ensure SSH is installed and add you public SSH key to the linux server.
1. Setup the host in VS Code/Cursor: `Cmd + Shift + P` and select `Remote-SSH: Add a New Host.
1. Connect to the host in VS Code/Cursor: `Cmd + Shift + P` and select `Remote-SSH: Connect to Host.
1. Forward port `9323` in VS Code/Cursor:: In the bottom view, select the `Ports` tab and click on the `Add Port` button.
1. Start the Playwright Server (adjust `E2E_URL` as needed): `DISPLAY=:99 E2E_URL=https://qa.quadratic-preview.com/ npx playwright test --ui --ui-host=0.0.0.0 --ui-port=9323`
1. Open Browser: Point to http://localhost:9323/ and start testing.

### Taking a single snapshot

```shell
npx playwright test -g "Connection goes down in Multiplayer Session" --update-snapshots --workers=1
```
