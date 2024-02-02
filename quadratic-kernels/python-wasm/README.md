# Quadratic Python WASM

A WASM runtime that leverages Pyodide as the backend.

## Development

Install dependencies

* [Python3](https://www.python.org/downloads/)
* [Poetry](https://python-poetry.org/docs/#installation)

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