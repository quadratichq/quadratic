#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(dirname -- "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(realpath -e -- "$SCRIPT_DIR")"

"${SCRIPT_DIR}/setup-poetry.sh"

source "${SCRIPT_DIR}/utility.sh"
pushd-quiet "${SCRIPT_DIR}"

source poetry-path.sh
poetry build

pushd-quiet "${SCRIPT_DIR}/dist/"
find . -name "*.whl" -exec cp '{}' "${SCRIPT_DIR}/../../quadratic-client/public/" \;
popd-quiet

popd-quiet
