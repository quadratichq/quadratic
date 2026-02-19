# Quadratic Cloud Worker

File processing worker for Quadratic Cloud. Executes scheduled tasks, connects to multiplayer for real-time updates, and manages file state.

## Purpose

- Processes scheduled tasks (cron jobs, webhooks)
- Syncs with multiplayer server for file updates
- Executes code cells and manages dependencies
- Reports results back to controller

## Configuration

Set via environment variables:
- `CONTAINER_ID` - Worker container UUID
- `CONTROLLER_URL` - Controller service endpoint
- `MULTIPLAYER_URL` - Multiplayer service endpoint
- `CONNECTION_URL` - Database connection service endpoint
- `FILE_ID` - File UUID to process
- `JWT` - Ephemeral JWT for authenticating with controller
- `TASKS` - Compressed/encoded task list
- `WORKER_INIT_DATA` - Compressed worker initialization data
- `THUMBNAIL_FONTS_DIR` - (Optional) Path to fonts for thumbnail rendering
- `THUMBNAIL_ICONS_DIR` - (Optional) Path to language icons for thumbnail rendering
- `THUMBNAIL_EMOJIS_DIR` - (Optional) Path to emoji assets for thumbnail rendering

## Build

From project root:

```shell
docker build -t quadratic-cloud-worker -f quadratic-cloud-worker/Dockerfile .
```

## Binaries

- `quadratic-cloud-worker` - Main worker process
- `simple` - Simplified worker for testing