#!/bin/sh

stop() {
  docker compose --profile "*" down -v --remove-orphans
  docker system prune -af
}

stop