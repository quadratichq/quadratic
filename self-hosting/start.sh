#!/bin/sh

REPO="https://github.com/quadratichq/quadratic.git"
BRANCH="self-hosting-setup"
DIR="self-hosting"

checkout() {
  git clone -b $BRANCH --filter=blob:none --no-checkout --depth 1 --sparse $REPO
  cd quadratic
  git sparse-checkout set ${DIR}/
  git checkout
  cd $DIR

}

start() {
  docker compose --profile "*" down
  yes | docker compose rm quadratic-client
  docker compose --profile "*" up
}

checkout
start