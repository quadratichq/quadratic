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

## Run Quadratic

In order to run the front-end and/or the server locally, you must have all the environment variables configured in `.env.local` (and `quadratic-api/.env.local` if you’re running a local server). You can grab the values from [our team Notion page](https://www.notion.so/Env-Variables-78b1a1da19d0421993abe8c449e51496?pvs=4) or by asking a team member.

### Run front-end locally

1. `npm run build:wasm` to compile the Rust code
2. `npm install` to install dependencies (run again when updating Rust)
3. Configure `.env.local` values.
4. `npm start` to run in browser or `npm run dev` to run with Electron

### Run server locally

1. `cd quadratic-api`
2. `npm i`
3. Install [postgress.app](https://postgresapp.com/) (follow instructions on website)
4. Create two environment files `.env.local` & `quadratic-api/.env.local`.

- For the `.env.local` react app ENV variables you will need to set the following variables:
  `REACT_APP_AUTH0_DOMAIN` `REACT_APP_AUTH0_CLIENT_ID` `REACT_APP_AUTH0_AUDIENCE` `REACT_APP_AUTH0_ISSUER` `REACT_APP_QUADRATIC_API_URL`
  You will need to ask your team for the appropriate values.

- For `quadratic-api/.env.local` you will need to set the `DATABASE_ENV` to point at your local postgres db. You will also need to copy `AUTH0_JWKS_URI` and `AUTH0_ISSUER` from `quadratic-api/.env_example` into your local `quadratic-api/.env.local` api env variables.

5. `npm run prisma:migrate`
6. Start both `npm run api:start` and `npm start`

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
