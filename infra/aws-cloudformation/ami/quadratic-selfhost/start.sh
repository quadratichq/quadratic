#!/bin/sh

# read the value of PROFILE from the file
PROFILE=$(cat PROFILE)

start() {
  docker compose $PROFILE --env-file .env.docker down -v --remove-orphans
  docker compose $PROFILE --env-file .env.docker up -d
  docker system prune -f
}

start