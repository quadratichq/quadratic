# Web Workers

## multiplayerWebWorker

The `multiplayerWebWorker` sends and handles messages from the multiplayer server.

`multiplayerCore` <-> `coreMultiplayer`
`multiplayerClient` <-> `multiplayer`

## coreWebWorker

The `coreWebWorker` provides quadratic-core with its own thread to do work.

### Connections

`coreWebWorker` <-> `renderWebWorker`
`coreWebWorker` <-> `quadratic-client`

## renderWebWorker

The `renderWebWorker` provides `CellLabel` with its own thread to render cells in the background.

### Connections

`renderWebWorker` <-> `quadratic-client`
`renderWebWorker` <-> `coreWebWorker`

## pythonWebWorker

This worker handles all Python calculations.

TODO: document this
