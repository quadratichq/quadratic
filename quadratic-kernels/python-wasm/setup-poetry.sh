#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(dirname -- "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(realpath -e -- "$SCRIPT_DIR")"

if [[ ! -x $(command -v poetry) ]]; then
    echo "Poetry could not be found. Installing..."
    curl -sSL https://install.python-poetry.org | python3 -
fi

source "${SCRIPT_DIR}/utility.sh"
pushd-quiet "${SCRIPT_DIR}"

source poetry-path.sh
poetry install --sync

popd-quiet
