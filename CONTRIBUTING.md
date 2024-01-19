# Quadratic Contribution Guide

Thank you for considering contributing to the data science spreadsheet :sparkles:

Read our [Code of Conduct](./CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

In this guide, you will get an overview of the contribution workflow from opening an issue, creating a PR, reviewing, and merging the PR.

If you have any problems getting the project to run locally, please create an issue to document the problem. See ["Create an issue"](#create-an-issue) below.

## Setup

1. Install NPM
2. Install [rustup](https://www.rust-lang.org/tools/install)
3. Install [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
4. `rustup target add wasm32-unknown-unknown` to install the WASM toolchain
5. Install cargo watch `cargo install cargo-watch`

## Run Quadratic

In order to run the front-end and/or the server locally, you must have all the environment variables configured in `.env.local` (and `quadratic-api/.env.local` if you’re running a local server). You can grab the values from [our team Notion page](https://www.notion.so/Env-Variables-78b1a1da19d0421993abe8c449e51496?pvs=4) or by asking a team member.

1. Start everything in one terminal: `npm start`

### Run front-end locally

1. `cd quadratic-client`
2. `npm i` to install dependencies
3. Configure `.env.local` values: `touch .env.local`
4. (a) `npm start` to run in browser or `npm run dev` to run with Electron; or (b) `npm run watch:front-end` to run in browser with automatic wasm rebuilding

#### Note:
To rebuild the rust types after `npm start`, you need to either manually call `npm run build:wasm:types`, or restart the `npm start" script.

### Run server locally

1. `cd quadratic-api`
2. `npm i`
3. Install and configure PostgreSQL:
   1. macOS users: Install [postgress.app](https://postgresapp.com/) (follow instructions on website) or `brew install postgresql` ([instructions](https://wiki.postgresql.org/wiki/Homebrew))
   2. Linux users:
      1. Install [postgres](https://www.prisma.io/dataguide/postgresql/setting-up-a-local-postgresql-database#setting-up-postgresql-on-linux)
      2. Configure your user permissions and create the database in the `psql` prompt:
         - `# CREATE ROLE username WITH LOGIN PASSWORD 'some_password';`
         - `# CREATE DATABASE "quadratic-api" WITH OWNER = username;`
         - `# GRANT ALL PRIVILEGES ON DATABASE "quadratic-api" TO username;`
         - `# ALTER ROLE username CREATEDB;`
4. Create two environment files `.env.local` & `quadratic-api/.env.local`.

   - Note: Linux users may need to call it `quadratic-api/.env` instead.

   - For the `.env.local` react app ENV variables you will need to set the following variables:
     `VITE_AUTH0_DOMAIN` `VITE_AUTH0_CLIENT_ID` `VITE_AUTH0_AUDIENCE` `VITE_AUTH0_ISSUER` `VITE_QUADRATIC_API_URL`
     You will need to ask your team for the appropriate values.

   - For `quadratic-api/.env.local` you will need to set the `DATABASE_ENV` to point at your local postgres db. You will also need to copy `AUTH0_JWKS_URI` and `AUTH0_ISSUER` from `quadratic-api/.env_example` into your local `quadratic-api/.env.local` api env variables.

5. `npm run prisma:migrate`

### Run tests (TypeScript)

1. `npm run build:wasm:nodejs` to compile the Rust code
2. `npm install` to install dependencies (run again when updating Rust)
3. `npm run test:all` to run all tests or `npm run test:unit` to run just unit tests

### Run tests (Rust)

1. `cd quadratic-core`
2. `cargo test --workspace`

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

## Quadratic is hiring

Check out our open roles ⟶ [careers.quadratichq.com](https://careers.quadratichq.com)
