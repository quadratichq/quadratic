#!/bin/bash

# remove old pyright stubs
rm -rf typings

# generate new pyright stubs
npx pyright --createstub quadratic_py/quadratic_api

# remove async and await from files to trick pyright into thinking they're sync functions
sed -i '' "s/async//g" typings/quadratic_py/quadratic_api/quadratic.pyi

# copy quadratic.pyi (pyright generated stubs) to typings as __builtins__.pyi to make them globally available
cp typings/quadratic_py/quadratic_api/quadratic.pyi quadratic_py/quadratic_api/pyright_initialization/builtins/__builtins__.pyi


# convert the pyi files into json
python3 quadratic_py/typeshed.py

# copy the converted file to the language server in quadratic-client
cp dist/pyright-initialization.json ../../quadratic-client/src/web-workers/pythonLanguageServer/pyright-initialization.json

# remove pyright stubs
rm -rf typings