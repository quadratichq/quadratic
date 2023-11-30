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
```

## Development

To develop with the watcher enabled:

```shell
RUST_LOG=info cargo watch -x 'run'
```

## API

### Enter Room

Signals that a user has entered the room

#### Request

```rust
EnterRoom {
    r#type: String,
    user_id: Uuid,
    file_id: Uuid,
    first_name: String,
    last_name: String,
    image: String,
},
```

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

```rust
User {
    id: Uuid,
    first_name: String,
    last_name: String,
    image: String,
}

Room {
    r#type: String,
    room: {
        file_id: Uuid,
        users: HashMap<Uuid, User>,
    },
},
```

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

### MouseMove

Signals that a user in a room moved their mouse.

#### Request

Rust:

```rust
MouseMove {
    user_id: Uuid,
    file_id: Uuid,
    x: f64,
    y: f64,
},
```

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

Rust:

```rust
MouseMove {
    user_id: Uuid,
    file_id: Uuid,
    x: f64,
    y: f64,
},
```

JSON:

```json
{
  "type": "MouseMove",
  "user_id": "00000000-0000-0000-0000-000000000000",
  "file_id": "00000000-0000-0000-0000-000000000001",
  "x": 10,
  "y": 10
}
``