#!/bin/bash

npx tsc --module nodenext --moduleResolution nodenext --skipLibCheck true dev/index.ts
node dev/index.js "$@"