# Quadratic Python WASM

A WASM runtime that leverages Pyodide as the backend.

## Dependencies

Install dependencies

* [Python3](https://www.python.org/downloads/)
* [Poetry](https://python-poetry.org/docs/#installation)

## Build

This will run the `./package.sh` script for any `.py` file change in this directory.

The wheel file will be placed in the `/quadratic-client/public` directory.

To build:

```shell
npm run build
```

## Development

To run the watcher during development:

```shell
npm run dev
```

This will run the `./package.sh` script for any `.py` file change in this directory.

The wheel file will be placed in the `/quadratic-client/public` directory.

## Tests

To run tests:

```shell
npm run test
```

To run tests with a watcher:

```shell
npm run test:watch
```

## Generate Typeshed Stubs for Pyright

In order for the language server (Pyright) to have information about types, we need to generate a json representation of the typeshed stubs, as well as configuration information.

Situations in which a new pyright initialization file generation is needed:

* Changes to the API in getCell, getCells (and their variants)
* Changes to third party stubs in `quadratic_py/quadratic_api/pyright_initialization/third_party_stubs`
* Changes to Pyright configuration in `quadratic_py/quadratic_api/pyright_initialization/config`

To generate Pyright-initialization.json and copy it over to the language server:

```shell
npm run gen:pyright:initialization
```

## Generate the Pyright Web Worker

The Pyright web worker runs the Pyright LSP in a web worker in JavaScript.  This file only needs to be generated once, so this script should **not be part of CI**.

To generate a Pyright web worker and copy it over to the language server:

```shell
npm run gen:pyright:worker
```
