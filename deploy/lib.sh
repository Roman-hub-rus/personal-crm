# Shared settings and helpers for the scripts in this folder; sourced by them, never run on its own.
# On the server this folder is /opt/personal-crm/deploy: every deploy replaces it with the repo's deploy/
# (crm-deploy.sh sync). One copy of the scripts and one compose.yml serve both environments on the server:
# production ("prod") and the test stand ("staging"). Each script picks its environment with use_env.

STACK_DIR=/opt/personal-crm
DEPLOY_DIR=$STACK_DIR/deploy
# Production only: database backups and the versions that passed the health check in production.
BACKUP_DIR=$STACK_DIR/backups
WORKING_VERSIONS=$STACK_DIR/working-versions
KEEP_WORKING_VERSIONS=20
IMAGE=personal-crm

# A person runs restore/rollback via `sudo -u deploy` from a home folder the deploy user cannot read.
cd "$STACK_DIR" 2>/dev/null || cd /

fail() {
  echo "$(basename "$0"): $*" >&2
  exit 1
}

# Selects the environment the next commands work on. Everything that differs between the two lives here:
#   ENV_NAME      compose project name (containers prod-app-1, staging-app-1, ...)
#   ENV_DIR       folder with the environment's .env (secrets, written by the owner) and its deploy lock
#   APP_PORT      port of the app on 127.0.0.1, where nginx proxies the public address to
#   CURRENT_TAG   image tag of the version that should run in this environment
#   DB_VOLUME     Docker volume with the database files
# Usage: use_env prod|staging
use_env() {
  case ${1:-} in
    prod)
      ENV_DIR=$STACK_DIR
      APP_PORT=3000
      CURRENT_TAG=current
      # The stack was first started as project "personal-crm" and the volume got its name then.
      DB_VOLUME=personal-crm_db-data
      ;;
    staging)
      ENV_DIR=$STACK_DIR/staging
      APP_PORT=3001
      CURRENT_TAG=staging-current
      DB_VOLUME=staging_db-data
      ;;
    *) fail "unknown environment: ${1:-<none>} (expected prod or staging)" ;;
  esac
  ENV_NAME=$1
  ENV_FILE=$ENV_DIR/.env
  LOCK_FILE=$ENV_DIR/deploy.lock
  HEALTH_URL=http://127.0.0.1:$APP_PORT/health
}

# The stack of the selected environment; secrets are interpolated from its .env. The scripts never read .env themselves.
# APP_TAG set by the caller picks another image version for one command (the migrations of a release).
# Usage: compose <docker compose arguments>; COMPOSE_YML overrides the file (sync checks the new one before using it).
compose() {
  [[ -n ${ENV_NAME:-} ]] || fail "internal error: use_env was not called"
  APP_TAG=${APP_TAG:-$CURRENT_TAG} APP_PORT=$APP_PORT DB_VOLUME=$DB_VOLUME \
    docker compose --project-name "$ENV_NAME" --file "${COMPOSE_YML:-$DEPLOY_DIR/compose.yml}" --env-file "$ENV_FILE" "$@"
}

# Deploys, restores and rollbacks of one environment change the same stack, so only one of them runs at a time.
# The two environments have separate locks: a deploy to the test stand never waits for production and back.
# Usage: take_lock <seconds to wait for the one that is running; 0 = do not wait> [lock file, default: the environment's]
take_lock() {
  local wait=$1 file=${2:-$LOCK_FILE} fd
  mkdir -p -m 700 "$(dirname "$file")"
  exec {fd}>"$file"
  if [[ $wait == 0 ]]; then flock --nonblock "$fd"; else flock --wait "$wait" "$fd"; fi \
    || fail "another deploy, restore or rollback of this environment is running; try again in a few minutes"
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

# Commit SHA of the app container of the selected environment as it is now, running or stopped; "none" before the very first deploy.
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
