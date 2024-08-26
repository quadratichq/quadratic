#!/bin/sh

start() {
  docker compose --profile "*" down
  yes | docker compose rm quadratic-client
  docker compose --profile "*" up
}

start