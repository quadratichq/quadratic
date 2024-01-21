#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(dirname -- "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(realpath -e -- "$SCRIPT_DIR")"

"${SCRIPT_DIR}/setup-poetry.sh"

pushd "${SCRIPT_DIR}" || exit

source poetry-path.sh
poetry build

pushd "${SCRIPT_DIR}/dist/"
find . -name "*.whl" -exec cp '{}' "${SCRIPT_DIR}/../quadratic-client/public/" \;
popd

popd
