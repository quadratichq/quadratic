#!/bin/bash

# General bump flow:
#
#   Read version from main VERSION file (located at root)
#   Bump RUST and JAVASCRIPT files (see listing above) according to command line args: major/minor/patch/set
#   Bump the main VERSION file
#   Commit added files
#   Create version tag (e.g. v1.0.1)
#   Push commit to main
#   Push tag to main
#
# Usage: bump.sh [TYPE]
#
# TYPE options:
#   major
#   minor
#   patch
#   set (just sets all versions to the current VERSION file version)
#   verify (checks if all versions match)

set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 {major|minor|patch|set|verify}"
  exit 1
fi

VERSION=$(cat VERSION)
TYPE=$1

RUST=(
  "Cargo.toml"
  "quadratic-connection/Cargo.toml"
  "quadratic-cloud-controller/Cargo.toml"
  "quadratic-cloud-worker/Cargo.toml"
  "quadratic-core-cloud/Cargo.toml"
  "quadratic-core/Cargo.toml"
  "quadratic-files/Cargo.toml"
  "quadratic-multiplayer/Cargo.toml"
  "quadratic-rust-shared/Cargo.toml"
)

JAVASCRIPT=(
  "package.json"
  "quadratic-api/package.json"
  "quadratic-client/package.json"
  "quadratic-client/public/version.json"
  "quadratic-shared/package.json"
)

if [[ -z "$VERSION" ]]; then
  echo "Version file is empty. Please set a version in the VERSION file. (e.g. 1.0.0)"
  exit 1
fi

if [[ ! "$TYPE" =~ ^(major|minor|patch|set|verify)$ ]]; then
  echo "Invalid bump type: $TYPE"
  echo "Usage: $0 {major|minor|patch|set|verify}"
  exit 1
fi

# bump semver version: major, minor, patch, set
bump_version() {
  local version=$1
  local type=$2
  local major=$(echo "$version" | cut -d. -f1)
  local minor=$(echo "$version" | cut -d. -f2)
  local patch=$(echo "$version" | cut -d. -f3)
  local set=$version

  case $type in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
    set)
      ;;
  esac

  echo "$major.$minor.$patch"
}

verify_versions() {
  local expected_version=$(cat VERSION)
  local mismatch=false

  for file in ${JAVASCRIPT[@]}; do
    if [ ! -f "$file" ]; then
      echo "Error: $file not found"
      exit 1
    fi
    local version=$(jq -r .version "$file")
    if [ "$version" != "$expected_version" ]; then
      echo "Version mismatch in $file: Expected $expected_version, found $version"
      mismatch=true
    fi
  done

  for file in ${RUST[@]}; do
    if [ ! -f "$file" ]; then
      echo "Error: $file not found"
      exit 1
    fi
    local version=$(grep '^version' "$file" | sed 's/version = "\(.*\)"/\1/')
    if [ "$version" != "$expected_version" ]; then
      echo "Version mismatch in $file: Expected $expected_version, found $version"
      mismatch=true
    fi
  done

  if [ "$mismatch" = false ]; then
    echo "All versions match: $expected_version"
  else
    echo "Version mismatch detected. Please review the above output."
    exit 1
  fi
}

if [ "$TYPE" = "verify" ]; then
  verify_versions
  exit 0
fi


NEW_VERSION=$(bump_version "$VERSION" "$TYPE")

# bump package.json files
for file in ${JAVASCRIPT[@]}; do
  if [ ! -f "$file" ]; then
    echo "Error: $file not found"
    exit 1
  fi
  PACKAGE_JSON_VERSION=$(jq -r .version "$file")
  echo "Current $file version is $PACKAGE_JSON_VERSION"

  jq --arg new_version "$NEW_VERSION" '.version = $new_version' "$file" > tmp.json && mv tmp.json "$file"

  echo "Updated $file version to $NEW_VERSION"
done

# bump Cargo.toml files
for file in ${RUST[@]}; do
  if [ ! -f "$file" ]; then
    echo "Error: $file not found"
    exit 1
  fi
  CARGO_TOML_VERSION=$(grep '^version' "$file" | sed 's/version = "\(.*\)"/\1/')
  echo "Current $file version is $CARGO_TOML_VERSION"

  sed -i.bak "s/^version = \".*\"/version = \"$NEW_VERSION\"/" "$file" && rm "${file}.bak"

  echo "Updated $file version to $NEW_VERSION"
done

# update the main VERSION file
echo $NEW_VERSION > VERSION

# After updating all versions
verify_versions

echo "Version bump to $NEW_VERSION complete!"
echo ""
echo "=========================================="
echo "REMINDER: Create a changelog entry!"
echo "=========================================="
echo ""
echo "Use this prompt to generate the changelog:"
echo ""
echo "---"
echo "Create a changelog entry for version $NEW_VERSION in quadratic-client/src/shared/constants/changelog.json. Review the git history since the last release to identify the key features, improvements, and bug fixes. Follow the existing format with version, date, changes array, and details HTML."
echo "---"
echo ""
echo "After creating the changelog entry, run prettier manually on changelog.json (otherwise CI will complain):"
echo "  npx prettier --write quadratic-client/src/shared/constants/changelog.json"