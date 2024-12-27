#!/bin/sh

stop() {
  docker compose --profile "*" --env-file .env.docker down -v --remove-orphans
  docker system prune -af
}

stop