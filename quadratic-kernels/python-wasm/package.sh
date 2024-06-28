#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(dirname -- "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(realpath "$SCRIPT_DIR")"

use_poetry=true

while test $# != 0
do
    case "$1" in
    --no-poetry) use_poetry=false ;;
    --) shift; break;;
    *)  echo "Invalid argument: $1" ;;
    esac
    shift
done


source "${SCRIPT_DIR}/utility.sh"
pushd-quiet "${SCRIPT_DIR}"


if [[ "${use_poetry}" == "true" ]]; then
    "${SCRIPT_DIR}/setup-poetry.sh"

    source poetry-path.sh
    echo "Building package with Poetry"
    poetry build
else
    python3 -m pip install build --break-system-packages

    echo "Building package with 'build'"
    python3 -m build
fi

pushd "${SCRIPT_DIR}/dist/"
find . -name "*.whl" -exec cp '{}' "${SCRIPT_DIR}/../../quadratic-client/public/" \;
popd

popd-quiet

echo "Python complete."
