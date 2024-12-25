#!/bin/sh

# read the value of PROFILE from the file
PROFILE=$(cat PROFILE)

start() {
  docker compose $PROFILE down -v --remove-orphans
  docker system prune -af
  docker compose $PROFILE up -d 
}

start