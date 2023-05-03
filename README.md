[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![E2E Tests](https://github.com/quadratichq/quadratic/actions/workflows/test-e2e.yml/badge.svg) ![Python Tests](https://github.com/quadratichq/quadratic/actions/workflows/test-python.yml/badge.svg) ![Unit Tests](https://github.com/quadratichq/quadratic/actions/workflows/test-unit.yml/badge.svg)
![Twitter Follow](https://img.shields.io/twitter/follow/QuadraticHQ)
![quadraticlogo4 1](https://user-images.githubusercontent.com/3479421/162037216-2fea1620-2310-4cfa-96fb-31299195e3a9.png)

## ![quardatic icon small](https://user-images.githubusercontent.com/3479421/162039117-02f85f2c-e382-4ed8-ac39-64efab17a144.svg) **_The data science spreadsheet_**

Infinite data grid with Python, JavaScript, and SQL built-in. Data Connectors to pull in your data.

Take your data and do something useful with it as quickly and easily as possible!

<img width="1552" alt="Screenshot 2023-02-24 at 2 57 36 PM" src="https://user-images.githubusercontent.com/3479421/221301059-921ad96a-878e-4082-b3b9-e55a54185c5d.png">

## Online Demo

We have a hosted version of the `main` branch available online.

**Try it out! --> <https://app.quadratichq.com>**

## Community

Join the conversation on our Discord channel -> <https://discord.gg/quadratic>

## Documentation

Read the documentation -> <https://docs.quadratichq.com>

# What is Quadratic?

Quadratic is a Web-based spreadsheet application that runs in the browser and as a native app (via Electron).

Our goal is to build a spreadsheet that enables you to pull your data from its source (SaaS, Database, CSV, API, etc) and then work with that data using the most popular data science tools today (Python, Pandas, SQL, JS, Excel Formulas, etc).

Quadratic has no environment to configure. The grid runs entirely in the browser with no backend service. This makes our grids completely portable and very easy to share.

## What can I do with Quadratic?

- Build dashboards
- Create internal tools in minutes
- Quickly mix data from different sources
- Explore your data for new insights

# Getting started

### Run Quadratic locally

1. Install npm, [rustup](https://www.rust-lang.org/tools/install), and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
2. Run `rustup target add wasm32-unknown-unknown`
3. Build the Rust/WASM `npm run build:wasm`
4. run `npm install`

Run Web `npm start`

Run Electron `npm run dev`

# Development progress and roadmap

_Quadratic is in ALPHA. For now, we do not recommend relying on Quadratic._

- [x] WebGL Grid (pinch and zoom grid)
- [x] Open and Save files locally
- [x] Python, Pandas Support (WASM)
- [x] Excel Formula Support (in progress)
- [x] Cell Formatting (issue [#44](https://github.com/quadratichq/quadratic/issues/44))
- [x] Undo / Redo (issue [#42](https://github.com/quadratichq/quadratic/issues/42))
- [ ] Multiplayer Support
- [ ] Charts and Graphs
- [ ] SQL Database Support
- [ ] AI Auto Complete

**Feature request or bug report?** Submit a [Github Issue](https://github.com/quadratichq/quadratic/issues/new/choose/).

**Want to contribute?** Read our [Contribution Guide](./CONTRIBUTING.md).

Want to learn more about how Quadratic works? Read the [How Quadratic Works](./docs/how_quadratic_works.md) doc.

## Examples

There are more example files are in the application file menu. File > Open sample

You can download them and then open them in Quadratic via File > Open Grid

## Quadratic is hiring

Check out our open roles -> [careers.quadratichq.com](https://careers.quadratichq.com)
