#!/usr/bin/env bash
# Switches the production app to another version that is still on the server. Run by a person, never by a deploy:
#   sudo -u deploy /opt/personal-crm/deploy/rollback.sh         lists the versions on the server
#   sudo -u deploy /opt/personal-crm/deploy/rollback.sh <sha>   switches the app to one (7+ first characters are enough)
#
# Only the app changes; the database is not touched and migrations never run backwards. For the data
# that belongs to that version, restore the backup with that version in its name (restore.sh).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# Production only: the test stand always runs what the last merge to main deployed.
use_env prod

# Human sessions do not queue behind a deploy: they stop and ask to try again later.
LOCK_WAIT_SECONDS=0

require_deploy_user "$@"
running=$(app_version)

if [[ $# -eq 0 ]]; then
  echo "App versions on this server, newest first:"
  for version in $(image_versions); do
    if [[ $version == "$running" ]]; then echo "  $version  (runs now)"; else echo "  $version"; fi
  done
  echo
  echo "To switch to one: sudo -u deploy $0 <version>"
  exit 0
fi
[[ $# -eq 1 && $1 =~ ^[0-9a-f]{7,40}$ ]] || fail "usage: rollback.sh [version: 7 to 40 characters of the commit SHA]"

take_lock "$LOCK_WAIT_SECONDS"
running=$(app_version)

matches=$(image_versions | grep "^$1" || true)
[[ -n $matches ]] || fail "version $1 is not on this server; run without arguments to see the list"
[[ $(wc -l <<<"$matches") -eq 1 ]] || fail "$1 matches several versions; give more characters"
target=$matches
[[ $target != "$running" ]] || fail "version $target already runs"

cat <<EOF

The production app will switch to another version. The database is not changed.

  Runs now:   $running
  Switch to:  $target

EOF
confirm

echo "==> Starting $IMAGE:$target"
docker tag "$IMAGE:$target" "$IMAGE:$CURRENT_TAG"
compose up --detach --wait --wait-timeout 120 app || {
  compose logs --tail 50 app >&2 || true
  fail "version $target does not start"
}
check_health "$target" || fail "version $target started, but the health check failed"
# The next deploy keeps this version as the last working one.
mark_working "$target"
echo "==> The app now runs $target"
echo "    If you also need the data of that version, restore a backup with $target in its name:"
echo "    sudo -u deploy $DEPLOY_DIR/restore.sh"
