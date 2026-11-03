#!/usr/bin/env bash
# PostToolUse Edit|Write: corre solo los tests de jest relacionados con el
# archivo editado del backend. Si fallan, sale con 2 para que Claude lo vea.
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
root="$CLAUDE_PROJECT_DIR"
case "$f" in
  "$root"/backend/src/*.ts) ;;
  *) exit 0 ;;
esac
out=$(cd "$root/backend" && npx jest --findRelatedTests "$f" --passWithNoTests 2>&1)
if [ $? -ne 0 ]; then
  echo "$out" | tail -20 >&2
  exit 2
fi
exit 0
