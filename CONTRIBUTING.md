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

See [DEVELOPMENT.md](/DEVELOPMENT.md)

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

## How to add environment variables

When possible, you can provide sensible fallbacks to environment variables so that if they're not present in the environment the app still functions.

But if you are adding a critical env variables that the app absolutely depends on, follow the instructions below.

### Local

1. Add it to your local `.env` file, e.g.
    - `FOO=some-value` in `quadratic-client/.env`
1. Add it to the repo `.env.*` files as relevant, e.g.
    - `FOO=xxx` in `quadratic-client/.env.example`
    - `FOO=xxx` in `quadratic-api/.env.test`

### Preview branches


1. Add it to the AWS parameter store
    - Ask someone with access to AWS to add this, e.g. `/quadratic-development/FOO`
2. Add the env variable to Cloudformation
    - Fetch from parameter store by adding it in `infra/aws-cloudformation/quadratic-preview.yml`
3. Add the env variable in [quadratic-selfhost](https://github.com/quadratichq/quadratic-selfhost)
    - Create a PR to add it in `docker-compose.yml`
4. Redeploy the app.
    - env variables are fetched once from the AWS parameter store when the stack is created (on PR open or reopen)

### Production

1. Ask David K.
