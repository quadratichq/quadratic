#!/bin/sh

stop() {
  docker compose --profile "*" down
}

stop