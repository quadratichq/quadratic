#!/bin/bash

# remove old build
rm -rf build

mkdir build
pushd build

git clone git@github.com:ddimaria/pyright-browser.git
pushd pyright-browser

npm run install:all

pushd packages/web-worker/
npm i
npm run build

cp dist/pyright.worker.js ../../../../../../quadratic-client/src/web-workers/pythonLanguageServer/pyright.worker.js

# go back to the initial directory
cd "$(dirs -l -0)" && dirs -c

# remove build
rm -rf build