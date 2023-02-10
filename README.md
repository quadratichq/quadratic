[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![E2E Tests](https://github.com/quadratichq/quadratic/actions/workflows/test-e2e.yml/badge.svg) ![Python Tests](https://github.com/quadratichq/quadratic/actions/workflows/test-python.yml/badge.svg) ![Unit Tests](https://github.com/quadratichq/quadratic/actions/workflows/test-unit.yml/badge.svg)

![quadraticlogo4 1](https://user-images.githubusercontent.com/3479421/162037216-2fea1620-2310-4cfa-96fb-31299195e3a9.png)

## ![quardatic icon small](https://user-images.githubusercontent.com/3479421/162039117-02f85f2c-e382-4ed8-ac39-64efab17a144.svg) **_The Data Science Spreadsheet_**

Infinite data grid with Python, JavaScript, and SQL built-in. Data Connectors to pull in your data.

Take your data and do something useful with it as quickly and easily as possible!

![Screen Shot 2022-04-07 at 4 15 52 PM](https://user-images.githubusercontent.com/3479421/162328478-198f27d1-4ab8-4334-8420-b082e68edefc.png)

## Online Demo

We have a hosted version of the `main` branch available online.

**Try it out! --> <https://app.quadratichq.com>**

## Community

Join the conversation on our Discord channel -> <https://discord.gg/quadratic>

## Documentation

All of our documentation is available at [docs.quadratichq.com](https://docs.quadratichq.com)

- [Quick Start Guide](https://docs.quadratichq.com/quick-start)
- [Python Cell Reference](https://docs.quadratichq.com/reference/python-cell-reference)
- [Pandas DataFrames in Quadratic](https://docs.quadratichq.com/reference/python-cell-reference/pandas-dataframe)
- [Development Updates](https://docs.quadratichq.com/development-updates)

# What is Quadratic?

Quadratic is a Web-based spreadsheet application that runs in the browser and as a native app (via Electron).

Our goal is to build a spreadsheet that enables you to pull your data from its source (SaaS, Database, CSV, API, etc) and then work with that data using the most popular data science tools today (Python, Pandas, SQL, JS, Excel Formulas, etc).

Quadratic has no environment to configure. The grid runs entirely in the browser with no backend service. This makes our grids completely portable and very easy to share.

## What can I do with Quadratic?

- Build dashboards
- Create internal tools in minutes
- Quickly mix data from different sources
- Explore your data for new insights

# Getting Started

### Run Quadratic Locally

Setup Rust

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

Build Rust `npm run build:wasm`

Install Dependencies `npm install`

Run Web `npm start`

Run Electron `npm run dev`

# Development Progress and Roadmap

_Quadratic is in ALPHA. For now, we do not recommend relying on Quadratic._

- [x] WebGL Grid (pinch and zoom grid)
- [x] Open and Save files locally
- [x] Python (WASM)
- [x] Pandas Support
- [ ] Moving cells and resizing columns (issue [#138](https://github.com/quadratichq/quadratic/pull/138))
- [ ] Cell Formatting (issue [#44](https://github.com/quadratichq/quadratic/issues/44))
- [ ] Undo / Redo (issue [#42](https://github.com/quadratichq/quadratic/issues/42))
- [ ] Database Connection Support (issue [#35](https://github.com/quadratichq/quadratic/issues/35))
- [ ] SQL Support (issue [#34](https://github.com/quadratichq/quadratic/issues/34))
- [ ] Quadratic Cloud Beta

**Feature request or bug report?** Submit a [Github Issue](https://github.com/quadratichq/quadratic/issues/new/choose/).

**Want to contribute?** Read our [Contribution Guide](./CONTRIBUTING.md).

Want to learn more about how Quadratic works? Read the [How Quadratic Works](./docs/how_quadratic_works.md) doc.

## Examples

There are more example files are located in the `examples` folder in this repo.

You can download them and then open them in Quadratic via File > Open Grid

## Quadratic is Hiring

Check out our open roles -> [careers.quadratichq.com](https://careers.quadratichq.com)
