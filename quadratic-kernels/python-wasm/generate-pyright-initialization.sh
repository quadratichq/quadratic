#!/bin/bash

# remove old pyright stubs
rm -rf typings

# generate new pyright stubs
npx pyright --createstub quadratic_py/quadratic_api

# copy quadratic.pyi (pyright generated stubs) to typings as __builtins__.pyi to make them globally available
cp typings/quadratic_py/quadratic_api/quadratic.pyi quadratic_py/quadratic_api/pyright_initialization/builtins/__builtins__.pyi

# convert the pyi files into json
python3 quadratic_py/typeshed.py

# copy the converted file to the language server in quadratic-client
cp dist/pyright-initialization.json ../../quadratic-client/src/ui/menus/CodeEditor/language-server/pyright-initialization.json

# remove pyright stubs
rm -rf typings