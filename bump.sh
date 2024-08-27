#!/bin/bash

set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 {major|minor|patch|init}"
  exit 1
fi

VERSION=$(cat VERSION)
TYPE=$1

RUST=(
  "Cargo.toml"
  "quadratic-connection/Cargo.toml"
  "quadratic-core/Cargo.toml"
  "quadratic-files/Cargo.toml"
  "quadratic-multiplayer/Cargo.toml"
  "quadratic-rust-client/Cargo.toml"
  "quadratic-rust-shared/Cargo.toml"
)

JAVASCRIPT=(
  "package.json"
  "quadratic-api/package.json"
  "quadratic-client/package.json"
  "quadratic-shared/package.json"
)

if [[ -z "$VERSION" ]]; then
  echo "Version file is empty. Please set a version in the VERSION file. (e.g. 1.0.0)"
  exit 1
fi

if [[ ! "$TYPE" =~ ^(major|minor|patch|init)$ ]]; then
  echo "Invalid bump type: $TYPE"
  exit 1
fi


# bump semver version: major, minor, patch, init
bump_version() {
  local version=$1
  local type=$2
  local major=$(echo "$version" | cut -d. -f1)
  local minor=$(echo "$version" | cut -d. -f2)
  local patch=$(echo "$version" | cut -d. -f3)
  local init=$version

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
    init)
      ;;
  esac

  echo "$major.$minor.$patch" 
}

NEW_VERSION=$(bump_version "$VERSION" "$TYPE")

# bump package.json files
for file in ${JAVASCRIPT[@]}; do
  PACKAGE_JSON_VERSION=$(jq -r .version $file)
  echo "Current $file version is $PACKAGE_JSON_VERSION"
  
  jq --arg new_version "$NEW_VERSION" '.version = $new_version' $file > tmp.json && mv tmp.json $file
  git add $file
  
  echo "Updated $file version to $NEW_VERSION"
done

# bump Cargo.toml files
for file in ${RUST[@]}; do
  CARGO_TOML_VERSION=$(grep '^version' $file | sed 's/version = "\(.*\)"/\1/')
  echo "Current $file version is $CARGO_TOML_VERSION"
  
  sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" $file
  git add $file

  echo "Updated $file version to $NEW_VERSION"
done

# update the main VERSION file
echo $NEW_VERSION > VERSION
git add VERSION

# commit and tag the new version
git commit -m "Bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Version $NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"

echo "Version bump to $NEW_VERSION complete!"
