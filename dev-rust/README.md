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

### Command-Line Options

The dev server supports the following command-line options:

- `--port <PORT>`: Port to run the server on (default: `8080`)
- `--dir <DIR>`: Base directory for state and other files (default: automatically detects workspace root)

Examples:

```bash
# Run on a different port
cargo run -- --port 9000

# Use a different base directory (should be the workspace root, not dev-rust)
cargo run -- --dir /path/to/quadratic

# Combine both options
cargo run -- --port 9000 --dir /path/to/dir
```

## Usage

1. Start the dev server: `npm run dev:rust` (or `npm run dev:rust:watch` for auto-reload)
   - Optionally specify `--port` to use a different port (default: `8080`)
   - Optionally specify `--dir` to use a different base directory (default: automatically detects workspace root)
   - **Note**: The `--dir` should point to the main quadratic workspace root (where `Cargo.toml` with `[workspace]` or `package.json` is located), not the `dev-rust` subdirectory
2. Open your browser to `http://localhost:8080` (or the port you specified)
   - **Note**: The web UI on port 8080 is only for visualization and monitoring. The dev server runs all services independently and does not require this page to be open.
3. Use the web UI to:
   - View logs from all services
   - Filter logs by selecting a service
   - Toggle watch mode for services
   - Show/hide logs from specific services
   - Kill/restart services

**Note**: All changes to service modes (watching, hidden, killed status) are automatically saved to `dev-rust-state.json` in the workspace root. The next time you start the dev server, it will restore these settings and start services accordingly. This file is gitignored and will not be committed to version control.

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
