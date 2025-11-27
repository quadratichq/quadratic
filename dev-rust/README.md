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

Use the npm scripts from the root of the project:

```bash
# Run the dev server (release mode)
npm run dev:rust

# Run the dev server with auto-reload on code changes
npm run dev:rust:watch
```

## Usage

1. Start the dev server: `npm run dev:rust` (or `npm run dev:rust:watch` for auto-reload)
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
  - ✕ Kill: Service can be killed (shows ↻ when killed to restart)

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
- **control.rs**: Process management and service control
- **server.rs**: Web server with REST API and WebSocket support
- **types.rs**: Data structures and service configurations
- **services/**: Service definitions and configurations
- **static/**: Web UI assets (HTML, CSS, JavaScript)
