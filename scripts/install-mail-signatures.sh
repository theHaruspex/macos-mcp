#!/usr/bin/env bash
# Copy example signature files into place (generic — no account UUIDs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIG_DIR="$ROOT/signatures"

if [[ -f "$SIG_DIR/manifest.json" ]]; then
  echo "signatures/manifest.json already exists — skipping."
else
  cp "$SIG_DIR/manifest.json.example" "$SIG_DIR/manifest.json"
  echo "Created signatures/manifest.json from example."
fi

for example in "$SIG_DIR"/*.txt.example; do
  [[ -f "$example" ]] || continue
  base="$(basename "$example" .example)"
  target="$SIG_DIR/$base"
  if [[ -f "$target" ]]; then
    echo "$target already exists — skipping."
  else
    cp "$example" "$target"
    echo "Created $target from example."
  fi
done

echo "Edit signatures/manifest.json and *.txt files with your real addresses, then restart Cursor."
