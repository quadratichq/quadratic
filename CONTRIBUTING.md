# Quadratic Contribution Guide

Thank you for considering contributing to Quadratic, the infinite data science spreadsheet :sparkles:

**Before contributing**, please respond to the issue you'd like to work on; someone on the team will get in touch to help. Alternatively, feel free to [reach out](https://www.quadratichq.com/contact) to the team to get in touch and discuss contributing.

Read our [Code of Conduct](./CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

In this guide, you will get an overview of the contribution workflow from opening an issue, creating a PR, reviewing, and merging the PR.

If you have any problems getting the project to run locally, please create an issue to document the problem. See ["Create an issue"](#create-an-issue) below.

## Quadratic is hiring

Check out our open roles ⟶ [careers.quadratichq.com](https://careers.quadratichq.com)

## Setup

### Local development environment

1. Install [nvm](https://github.com/nvm-sh/nvm)

2. Install Node and NPM

   ```sh
    nvm install && nvm use
   ```

3. Install [rustup](https://www.rust-lang.org/tools/install)

4. Install [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

5. Install WASM toolchain

   ```sh
    rustup target add wasm32-unknown-unknown
   ```

6. Install cargo watch

   ```sh
    cargo install cargo-watch
   ```

7. Install [Python](https://wiki.python.org/moin/BeginnersGuide/Download)

8. Install [Docker Desktop](https://docs.docker.com/desktop/)

### Configure Auth0 account

1. Create an account on [Auth0](https://auth0.com/)

2. Create a new Regular Web Application

3. In the settings tab, configure the following:
   - Allowed Callback URLs: `http://localhost:3000/login-result?redirectTo`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
   - Allowed Origins (CORS): `http://localhost:3000`

### Configure .env files

1. Create .env files using the template .env.example files

   ```sh
    cp .env.example .env && \
    cp quadratic-api/.env.example quadratic-api/.env && \
    cp quadratic-client/.env.example quadratic-client/.env && \
    cp quadratic-files/.env.example quadratic-files/.env && \
    cp quadratic-multiplayer/.env.example quadratic-multiplayer/.env
   ```

   These are prefilled with values required to access services in docker.

2. Replace the Auth0 values in

   - `.env`
   - `quadratic-api/.env`
   - `quadratic-client/.env`
   - `quadratic-multiplayer/.env`

   These are prefilled with representative values and only the `xxxxxxxxxxxxxxxx` parts should change.

## Run Quadratic

1. Install dependencies

   ```sh
    npm install
   ```

2. Start Redis, Postgres and AWS in docker

   ```sh
    npm run docker:up
   ```

3. Start all quadratic packages

   ```sh
    npm run start
   ```

   Press `h` in termial to open help menu. Use shortcuts from this menu to toggle watch mode, logs, etc.

   To run all packages in watch mode, use

   ```sh
    npm run dev
   ```

## Run tests

### TypeScript

1. Go to the `quadratic-client` directory

   ```sh
    cd quadratic-client
   ```

2. Compile the Rust code

   ```sh
    build:wasm:nodejs
   ```

3. Install dependencies (run again when updating Rust)

   ```sh
    npm install
   ```

4. Run all tests

   ```sh
    npm run test:all
   ```

   or run just unit tests

   ```sh
    npm run test:unit
   ```

### Rust

1. Go to the `quadratic-core` directory

   ```sh
    cd quadratic-core
   ```

2. Run test

   ```sh
    cargo test --workspace
   ```

## Feature requests and bugs

Quadratic uses [GitHub issues](https://github.com/quadratichq/quadratic/issues) to track all feature requests and bugs.

### Create an issue

If you have a feature request or spot a problem, [search if an issue already exists](https://docs.github.com/en/github/searching-for-information-on-github/searching-on-github/searching-issues-and-pull-requests#search-by-the-title-body-or-comments). If a related issue does not exist, please open a new issue!

When reporting a bug, please provide:

- Issue description
- Steps to reproduce the issue
- What's the expected result?
- What's the actual result?
- Additional details / screenshots

### Solve an issue

Scan through our [existing issues](https://github.com/quadratichq/quadratic/issues) to find one that interests you. You can narrow down the search using `labels` as filters. See [Labels](/contributing/how-to-use-labels.md) for more information.

### How to contribute code

1. Fork the repository.
2. Run Quadratic locally. See "Getting Started" above.
3. Create a new working branch and start making your changes!
4. Lint and format your changes using Prettier.

### Pull Request

When you're finished with your changes:

1. Create a pull request.
2. Link your PR to the GitHub Issue [link PR to issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue) if you are working on an Issue.
3. Enable the checkbox to [allow maintainer edits](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork) so the branch can be updated for a merge.

We review all PRs quickly, so we will give you feedback in short order!

### Your PR is merged

Congratulations! :tada::tada: Quadratic is better because of you. :sparkles:

Once your PR is merged, contributors will be publicly visible on the GitHub Page.

## How to test js.rs functions (Rust functions that call into TS)

Use `#[serial]` from `use serial_test::serial;` for the test function (this
ensures that the global static `TEST_ARRAY` is not changed by other functions).

Any time a jsFunction is called from js.rs, the function and its args are added
to the `lazy_static TEST_ARRAY` in js.rs. You can access the results of that via
two functions:

`expect_js_call(name: &str, args: String, clear: bool)` - asserts whether the
function with the `name` has the args (usually formatted as `format!("{},{}",
&arg1, &arg2)` -- but check the js.rs for the actual format). This removes that
call from the `TEST_ARRAY`. If `clear` = true then it also clears the entire
`TEST_ARRAY` (which is needed since we don't have 100% coverage on all js.rs
calls yet).`

`expect_js_call_count(name: &str, count: usize, clear: bool)` - asserts whether
the `name` function was called a specific number of times. If it matches it will
clear the `TEST_ARRAY` of those functions. If `clear` = true then it will also
clear the entire `TEST_ARRAY` (for the same reason as above).
