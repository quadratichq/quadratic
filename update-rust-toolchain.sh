#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./update-rust-toolchain.sh 1.89.0
# Sets channel="<arg>" in every rust-toolchain found under repo root.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log() { printf '[update-rust-toolchain] %(%Y-%m-%dT%H:%M:%S%z)T %s\n' -1 "$*"; }

version="${1:-}"
if [[ -z "$version" ]]; then
  echo "Usage: $0 <version>   e.g. $0 1.89.9" >&2
  exit 1
fi

log "Start. Root: ${ROOT_DIR}"
log "Target channel version: ${version}"

log "Locating rust-toolchain files..."
mapfile -d '' files < <(find "$ROOT_DIR" -type f -name "rust-toolchain" -print0)
count="${#files[@]}"
log "Found ${count} file(s)."
if (( count == 0 )); then
  log "WARNING: no rust-toolchain files found. Nothing to update."
  exit 0
fi
for f in "${files[@]}"; do log " - $f"; done

log "Updating files to channel=\"${version}\"..."
updated=0
skipped=0

for file in "${files[@]}"; do
  log "Processing: ${file}"
  if ! grep -q '^\[toolchain\]' "$file"; then
    log "  Skipping: missing [toolchain] header"
    ((skipped++)) || true
    continue
  fi

  before="$(awk -F'"' '/^[[:space:]]*channel[[:space:]]*=/ { print $2; exit }' "$file" || true)"
  log "  Current channel: ${before:-<none>}"

  sed -i.bak -E "s/^([[:space:]]*channel[[:space:]]*=[[:space:]]*\")[^\"]*(\"[[:space:]]*)$/\1${version}\2/" "$file"
  rm -f "${file}.bak"

  after="$(awk -F'"' '/^[[:space:]]*channel[[:space:]]*=/ { print $2; exit }' "$file" || true)"
  log "  Updated channel: ${after:-<none>}"

  if [[ "$after" != "$version" ]]; then
    log "  ERROR: write verification failed (expected ${version}, got ${after:-<none>})"
    exit 1
  fi
  ((updated++)) || true
done

log "Summary"
log "  Updated: ${updated}"
log "  Skipped: ${skipped}"
log "Done."