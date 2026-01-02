#!/bin/bash

# Usage: E2E_URL=https://branch-name.quadratic-preview.com/ ./update-all-snapshots.sh

# Fail if E2E_URL is not provided
if [[ -z "$E2E_URL" ]]; then
    echo "Error: E2E_URL environment variable is required"
    echo "Usage: E2E_URL=https://branch-name.quadratic-preview.com/ ./update-all-snapshots.sh"
    exit 1
fi

# Files to skip (add filenames here to exclude them from snapshot updates)
# Example:
#
# SKIP_FILES=(
#     "aiChat.spec.ts"
#     "auth.spec.ts"
#     "billing.spec.ts"
#     "dashboardFileActions.spec.ts"
# )
SKIP_FILES=(
    # "aiChat.spec.ts"
    # "auth.spec.ts"
    # "billing.spec.ts"
    # "dashboardFileActions.spec.ts"
    # "dashboardViewsMyFiles.spec.ts"
    # "formatting.spec.ts"
    # "multiplayer.spec.ts"
    # "resources.spec.ts"
    # "spreadsheetComputation.spec.ts"
    # "spreadsheetFind.spec.ts"
    # "spreadsheetFormatting.spec.ts"
    # "spreadsheetInteraction.spec.ts"
    # "spreadsheetKeyboard.spec.ts"
    # "spreadsheetMouse.spec.ts"
    # "spreadsheetTables.spec.ts"
    # "spreadsheetUI.spec.ts"
    # "spreadsheetValidations.spec.ts"
    # "team.spec.ts"
    # "viewport.spec.ts"
)

echo "Using E2E_URL: $E2E_URL"
echo "Updating snapshots for all spec files..."
echo "Skipping: ${SKIP_FILES[*]}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to check if a file should be skipped
should_skip() {
    local file="$1"
    for skip in "${SKIP_FILES[@]}"; do
        if [[ "$file" == "$skip" ]]; then
            return 0
        fi
    done
    return 1
}

# Loop through all spec.ts files in the src directory (no recursion)
for file in "$SCRIPT_DIR/src"/*.spec.ts; do
    if [[ -f "$file" ]]; then
        # Extract just the filename without path
        filename=$(basename "$file")
        
        # Check if this file should be skipped
        if should_skip "$filename"; then
            echo "Skipping: $filename"
            continue
        fi
        
        echo "=========================================="
        echo "Updating snapshots for: $filename"
        echo "=========================================="
        
        E2E_URL="$E2E_URL" npx playwright test -g "$filename" --update-snapshots
        
        echo ""
    fi
done

echo "Done updating all snapshots!"

