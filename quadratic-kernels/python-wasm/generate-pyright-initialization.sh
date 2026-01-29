#!/bin/bash

# remove old pyright stubs
rm -rf dist/typings

# Set PYTHONPATH so pyright can find quadratic_py
export PYTHONPATH="$PWD:$PYTHONPATH"

# generate new pyright stubs
npx pyright --createstub quadratic_py.quadratic_api

mv typings dist/typings

pushd dist/typings
git clone git@github.com:quadratichq/typeshed.git

# remove async and await from files to trick pyright into thinking they're sync functions
# Also clean up extra whitespace left behind (e.g., "async def" -> "def" not " def")
sed -i '' "s/async //g" quadratic_py/quadratic_api/quadratic.pyi

# copy quadratic.pyi (pyright generated stubs) to typings as __builtins__.pyi to make them globally available
mkdir builtins
mv quadratic_py/quadratic_api/quadratic.pyi builtins/__builtins__.pyi
rm -rf quadratic_py/quadratic_api

popd

# convert the pyi files into json
python3 quadratic_py/typeshed.py

# copy the converted file to the language server in quadratic-client
cp dist/pyright-initialization.json ../../quadratic-client/src/app/web-workers/pythonLanguageServer/pyright-initialization.json

# remove pyright stubs
rm -rf dist/typings