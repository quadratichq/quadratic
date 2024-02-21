# Quadratic Python WASM

A WASM runtime that leverages Pyodide as the backend.

## Dependencies

Install dependencies

* [Python3](https://www.python.org/downloads/)
* [Poetry](https://python-poetry.org/docs/#installation)

## Development

To run the watcher during development:

```shell
npm run dev
```

This will run the `./package.sh` script for any `.py` file change in this directory.

The wheel file will be placed in the `/quadratic-client/public` directory.

## Build

To run tests:

```shell
npm run test
```

## Tests

To run tests:

```shell
npm run test
```

To run tests with a watcher:

```shell
npm run test:watch
```