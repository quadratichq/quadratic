# Quadratic Multiplayer

An Axum Websocket Server for handling presence and file syncing.

## Running

First, copy over the environment variables (customize if applicable):

```shell
cp .env.example .env
```

To run the server:

```shell
RUST_LOG=info cargo run

// npm alternative
npm start
```

Assuming the `HOST` is set to `127.0.0.1` and the `PORT` is set to `3001`, the websocket endpoint is available at `http://127.0.0.1:3001/ws` or `ws://127.0.0.1:3001/ws`.

## Development

To develop with the watcher enabled:

```shell
RUST_LOG=info cargo watch -x 'run'

// npm alternative
npm run dev
```

### Testing

To develop with the watcher enabled:

```shell
cargo test

// npm alternative
npm run test

// watcher
RUST_LOG=info cargo watch -x 'test'

// npm alternative
npm run test:watch
```

### Linting

To develop with the watcher enabled:

```shell
cargo clippy --all-targets --all-features -- -D warnings

// npm alternative
npm run lint
```

## API

### Health Checks

#### Request

```shell
curl http://127.0.0.1:3001/health -i
```

#### Response

```shell
HTTP/1.1 200 OK
content-length: 0
date: Mon, 08 Jan 2024 22:56:23 GMT
```

### Enter Room

Signals that a user has entered the room

#### Request

JSON:

```json
{
  "type": "EnterRoom",
  "first_name": "David",
  "last_name": "DiMaria",
  "image": "https://lh3.googleusercontent.com/a/ACg8ocLcJuKVkU7-Zr67hinRLyzgO_o3VOeMlOA17HcOlKe1fQ=s96-c",
  "user_id": "00000000-0000-0000-0000-000000000000",
  "file_id": "00000000-0000-0000-0000-000000000001"
}
```

#### Response

JSON:

```json
{
  "type":"Room",
  "room":{
    "file_id":"00000000-0000-0000-0000-000000000001",
    "users":{
      "00000000-0000-0000-0000-000000000000":{
        "first_name":"David",
        "last_name":"DiMaria",
        "image":"https://lh3.googleusercontent.com/a/ACg8ocLcJuKVkU7-Zr67hinRLyzgO_o3VOeMlOA17HcOlKe1fQ=s96-c"
      },
      "00000000-0000-0000-0000-000000000002":{
        "first_name":"David",
        "last_name":"Figatner",
        "image":"https://lh3.googleusercontent.com/a/ACg8ocLcJuKVkU7-Zr67hinRLyzgO_o3VOeMlOA17HcOlKe1fQ=s96-c"
      }
    }
  }
}
```

### Leave Room

Signals that a user leaves a room

#### Request

JSON:

```json
{
  "type": "LeaveRoom",
  "user_id": "00000000-0000-0000-0000-000000000000",
  "file_id": "00000000-0000-0000-0000-000000000001"
}
```

#### Response

JSON:

```json
{
  "type":"Room",
  "room":{
    "file_id":"00000000-0000-0000-0000-000000000001",
    "users":{
      "00000000-0000-0000-0000-000000000002":{
        "first_name":"David",
        "last_name":"Figatner",
        "image":"https://lh3.googleusercontent.com/a/ACg8ocLcJuKVkU7-Zr67hinRLyzgO_o3VOeMlOA17HcOlKe1fQ=s96-c"
      }
    }
  }
}
```

### MouseMove

Signals that a user in a room moved their mouse.

#### Request

JSON:

```json
{
  "type": "MouseMove",
  "user_id": "00000000-0000-0000-0000-000000000000",
  "file_id": "00000000-0000-0000-0000-000000000001",
  "x": 10,
  "y": 10
}
```

#### Response

JSON:

```json
{
  "type": "MouseMove",
  "user_id": "00000000-0000-0000-0000-000000000000",
  "file_id": "00000000-0000-0000-0000-000000000001",
  "x": 10,
  "y": 10
}
```


### Heartbeat

Signals that a user is still active in a room

#### Request

JSON:

```json
{
  "type": "Heartbeat",
  "user_id": "00000000-0000-0000-0000-000000000000",
  "file_id": "00000000-0000-0000-0000-000000000001",
}
```

#### Response

JSON:

```json
{}
```
