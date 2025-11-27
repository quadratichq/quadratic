# Quadratic Dev Server (Rust)

A Rust-based development server for Quadratic with a web-based UI for managing and monitoring development services.

## Features

- **Web-based UI**: Access the dev server through your browser instead of the terminal
- **Real-time log streaming**: View logs from all services in real-time via WebSocket
- **Service filtering**: Show/hide logs from specific services
- **Watch mode toggling**: Enable/disable watch mode for each service
- **Service management**: Start, stop, and kill services from the web UI
- **Status monitoring**: See the status of all services at a glance

## Building

```bash
cd dev-rust
cargo build --release
```

## Running

```bash
# Run with default settings (port 8080, client watching enabled)
cargo run

# Run on a custom port
cargo run -- --port 3000

# Enable watching for specific services
cargo run -- --api --core --multiplayer

# Watch all services
cargo run -- --all
```

## CLI Options

- `-p, --port <PORT>`: Port for the web server (default: 8080)
- `-r, --client`: Watch client (default: true)
- `-a, --api`: Watch API
- `-c, --core`: Watch core
- `-m, --multiplayer`: Watch multiplayer
- `-f, --files`: Watch files
- `-n, --connection`: Watch connection
- `-y, --python`: Watch python
- `-s, --shared`: Watch shared
- `-l, --all`: Watch all services
- `-t, --skip-types`: Skip types compilation
- `-u, --no-rust`: Run without Rust compilation

## Usage

1. Start the dev server: `cargo run`
2. Open your browser to `http://localhost:8080`
3. Use the web UI to:
   - View logs from all services
   - Filter logs by selecting a service
   - Toggle watch mode for services
   - Show/hide logs from specific services
   - Kill/restart services

## Web UI Features

### Service List
- Shows all available services with their current status
- Status indicators:
  - 🟢 Green: Running
  - 🟠 Orange (pulsing): Starting
  - 🔴 Red: Error
  - ⚫ Gray: Stopped/Killed
- Badges:
  - 👀 Watching: Service is in watch mode
  - 🙈 Hidden: Logs are hidden for this service

### Logs View
- Real-time log streaming from all services
- Filter by service by clicking on a service in the sidebar
- Color-coded by service type
- Timestamps for each log entry

### Controls
- **Toggle Watch**: Enable/disable watch mode for a service
- **Show/Hide Logs**: Toggle visibility of logs for a service
- **Kill/Restart**: Kill a running service or restart a killed service

## Architecture

- **main.rs**: Entry point and server initialization
- **cli.rs**: Command-line argument parsing
- **control.rs**: Process management and service control
- **server.rs**: Web server with REST API and WebSocket support
- **types.rs**: Data structures and service configurations
- **static/index.html**: Web UI

## Differences from `/dev`

- Written in Rust instead of TypeScript
- Web-based UI instead of terminal UI
- WebSocket-based log streaming
- REST API for service control
- Better suited for remote development and monitoring
