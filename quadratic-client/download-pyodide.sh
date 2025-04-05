#!/bin/bash

set -e

# Configuration
PYODIDE_VERSION="0.27.4"
PYODIDE_URL="https://github.com/pyodide/pyodide/releases/download/${PYODIDE_VERSION}/pyodide-${PYODIDE_VERSION}.tar.bz2"
EXPECTED_CHECKSUM="27fe60bc11308a25ef5800848b7e7fd160716f77852e681e1fbea0d8f9dd7531"
TARGET_DIR="public"

# Cleanup existing files
rm -rf "$TARGET_DIR/pyodide"

# Download the file
echo "Downloading pyodide-${PYODIDE_VERSION}.tar.bz2..."
if ! curl -L -f "$PYODIDE_URL" -o "./pyodide-${PYODIDE_VERSION}.tar.bz2"; then
    echo "Error: Failed to download pyodide" >&2
    exit 1
fi

# Verify the download exists
if [ ! -f "./pyodide-${PYODIDE_VERSION}.tar.bz2" ]; then
    echo "Error: Download file not found" >&2
    exit 1
fi

# Verify checksum
echo "Verifying checksum..."
computed_checksum=$(sha256sum "./pyodide-${PYODIDE_VERSION}.tar.bz2" | cut -d' ' -f1)
if [ "$computed_checksum" != "$EXPECTED_CHECKSUM" ]; then
    echo "Error: Checksum mismatch for pyodide-${PYODIDE_VERSION}.tar.bz2" >&2
    echo "Expected: $EXPECTED_CHECKSUM" >&2
    echo "Got:      $computed_checksum" >&2
    rm -f "./pyodide-${PYODIDE_VERSION}.tar.bz2"
    exit 1
fi
echo "✓ Checksum verified"

# Unpack to the target directory
echo "Unpacking to $TARGET_DIR..."
if ! tar -xjf "./pyodide-${PYODIDE_VERSION}.tar.bz2" -C "$TARGET_DIR"; then
    echo "Error: Failed to extract archive" >&2
    rm -f "./pyodide-${PYODIDE_VERSION}.tar.bz2"
    exit 1
fi

# Cleanup downloaded file
echo "Cleaning up downloaded file..."
rm -f "./pyodide-${PYODIDE_VERSION}.tar.bz2"

echo "Successfully completed!"
