# Shared settings and helpers for the scripts in this folder; sourced by them, never run on its own.
# On the server this folder is /opt/personal-crm/deploy: every deploy replaces it with the repo's deploy/
# (crm-deploy.sh sync), next to the stack's .env and the backups.

STACK_DIR=/opt/personal-crm
DEPLOY_DIR=$STACK_DIR/deploy
BACKUP_DIR=$STACK_DIR/backups
LOCK_FILE=$STACK_DIR/deploy.lock
# Versions that passed the health check in production, oldest first, one per line (see mark_working).
WORKING_VERSIONS=$STACK_DIR/working-versions
KEEP_WORKING_VERSIONS=20
IMAGE=personal-crm
HEALTH_URL=http://127.0.0.1:3000/health

# A person runs restore/rollback via `sudo -u deploy` from a home folder the deploy user cannot read.
cd "$STACK_DIR" 2>/dev/null || cd /

fail() {
  echo "$(basename "$0"): $*" >&2
  exit 1
}

# The production stack: compose project "prod", secrets interpolated from /opt/personal-crm/.env.
# The scripts never read .env themselves.
compose() {
  docker compose --project-name prod --file "$DEPLOY_DIR/compose.yml" --env-file "$STACK_DIR/.env" "$@"
}

# Deploys, restores and rollbacks change the same stack, so only one of them runs at a time.
# Usage: take_lock <seconds to wait for the one that is running; 0 = do not wait>
take_lock() {
  exec 9>"$LOCK_FILE"
  if [[ $1 == 0 ]]; then flock --nonblock 9; else flock --wait "$1" 9; fi \
    || fail "another deploy, restore or rollback is running; try again in a few minutes"
}

# Restore and rollback are run by a person; files they create must stay readable by the deploy scripts.
require_deploy_user() {
  [[ $(id -un) == deploy ]] || fail "run it as the deploy user: sudo -u deploy $0 $*"
}

# Waits for the person at the terminal to type exactly "yes"; anything else cancels.
confirm() {
  local answer
  [[ -t 0 ]] || fail "run it from a terminal: it asks for confirmation"
  read -r -p 'Type "yes" to continue, anything else cancels: ' answer
  [[ $answer == yes ]] || fail "cancelled, nothing was changed"
}

# Commit SHA of the app container as it is now, running or stopped; "none" before the very first deploy.
app_version() {
  local container version
  container=$(compose ps --all --quiet app 2>/dev/null || true)
  if [[ -n $container ]]; then
    version=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" | sed -n 's/^APP_VERSION=//p')
  fi
  echo "${version:-none}"
}

# Commit SHAs of the app images on this server, newest first.
image_versions() {
  docker images "$IMAGE" --format '{{.CreatedAt}}|{{.Tag}}' | sort -r | cut -d'|' -f2 | grep -E '^[0-9a-f]{40}$' || true
}

# Records that <sha> passed the health check in production: called by a successful release or rollback only,
# so the version of a failed deploy never counts as working. Callers hold the deploy lock.
mark_working() {
  local sha=$1
  if [[ $(tail -n 1 "$WORKING_VERSIONS" 2>/dev/null) != "$sha" ]]; then
    echo "$sha" >>"$WORKING_VERSIONS"
  fi
  tail -n "$KEEP_WORKING_VERSIONS" "$WORKING_VERSIONS" >"$WORKING_VERSIONS.new"
  mv "$WORKING_VERSIONS.new" "$WORKING_VERSIONS"
}

# The newest working version other than <sha> whose image is still on this server; prints nothing if there is none.
last_working_except() {
  local skip=$1 on_server i
  local -a versions
  [[ -f $WORKING_VERSIONS ]] || return 0
  on_server=$(image_versions)
  mapfile -t versions <"$WORKING_VERSIONS"
  for ((i = ${#versions[@]} - 1; i >= 0; i--)); do
    if [[ -n ${versions[i]} && ${versions[i]} != "$skip" ]] && grep --quiet --line-regexp --fixed-strings -- "${versions[i]}" <<<"$on_server"; then
      echo "${versions[i]}"
      return 0
    fi
  done
}

# Smoke test: /health must answer and report the expected version. Prints the answer.
check_health() {
  local expected=$1 health
  if ! health=$(curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-all-errors "$HEALTH_URL"); then
    echo "health check: no answer from $HEALTH_URL" >&2
    return 1
  fi
  echo "$health"
  [[ $health == *"\"version\":\"$expected\""* ]] || {
    echo "health check: expected version $expected" >&2
    return 1
  }
}
