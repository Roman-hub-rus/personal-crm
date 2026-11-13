#!/usr/bin/env bash
# Forced command of the GitHub Actions deploy key: ~deploy/.ssh/authorized_keys runs this script
# (/opt/personal-crm/deploy/crm-deploy.sh) on every connection with that key, and the command the client
# asked for arrives in SSH_ORIGINAL_COMMAND. Nothing else can be run with the key: restore.sh and
# rollback.sh are only for a person logged in to the server.
#
# Allowed commands:
#   sync                  replace /opt/personal-crm/deploy with the repo's deploy/ folder (gzipped tar on stdin)
#   load                  read a gzipped `docker save` archive of personal-crm:<sha> from stdin
#   release prod <sha>    production: back up the database, apply migrations with personal-crm:<sha>, switch the app to it
#   release staging <sha> the test stand: the same without the backup
#
# A failed release is not rolled back: the deploy goes red and a person decides (see rollback.sh).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

KEEP_BACKUPS=10
# A deploy waits this long for a restore or rollback that a person is running.
LOCK_WAIT_SECONDS=600

# The new folder is checked before it replaces the old one, so a broken script or compose file
# never becomes the forced command or the stack definition.
# Both environments run these scripts, so the folder is replaced only while neither of them is deploying.
sync_scripts() {
  local new=$STACK_DIR/deploy.new old=$STACK_DIR/deploy.old script env
  for env in prod staging; do
    use_env "$env"
    take_lock "$LOCK_WAIT_SECONDS"
  done
  rm -rf "$new" "$old"
  mkdir "$new"
  tar --extract --gzip --no-same-owner --directory "$new"

  [[ -x $new/crm-deploy.sh && -f $new/lib.sh && -f $new/compose.yml ]] \
    || fail "crm-deploy.sh, lib.sh or compose.yml is missing; scripts on the server left as they were"
  for script in "$new"/*.sh; do
    bash -n "$script" || fail "syntax error in $(basename "$script"); scripts on the server left as they were"
  done
  # The test stand is checked once its owner has written its .env; until then only its own release fails.
  for env in prod staging; do
    use_env "$env"
    [[ $env == prod || -f $ENV_FILE ]] || continue
    COMPOSE_YML=$new/compose.yml compose config --quiet \
      || fail "compose.yml is invalid for $env; scripts on the server left as they were"
  done

  # The running copy of this script keeps reading its old file, which stays readable until it exits.
  if [[ -d $DEPLOY_DIR ]]; then mv "$DEPLOY_DIR" "$old"; fi
  mv "$new" "$DEPLOY_DIR"
  rm -rf "$old"
  echo "==> Deploy scripts updated"
}

load() {
  gunzip | docker load
}

# One script for both environments; only production backs up the database first and keeps track of working versions.
release() {
  local sha=$2 previous
  use_env "$1"
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || fail "release expects a full commit SHA"
  docker image inspect "$IMAGE:$sha" >/dev/null 2>&1 || fail "image $IMAGE:$sha is not loaded"
  [[ -f $ENV_FILE ]] || fail "$ENV_FILE is missing: the owner writes it once (see README)"
  take_lock "$LOCK_WAIT_SECONDS"
  previous=$(app_version)
  echo "==> Environment: $ENV_NAME, app version before this deploy: $previous"

  if [[ $ENV_NAME == prod ]]; then
    # Servers deployed before the list of working versions existed: the version that runs now counts as working
    # if it answers the health check. Once the list exists, only successful releases and rollbacks add to it.
    if [[ ! -f $WORKING_VERSIONS && $previous != none ]] && check_health "$previous" >/dev/null 2>&1; then
      mark_working "$previous"
    fi

    echo "==> Backing up the database"
    "$DEPLOY_DIR/backup.sh" >/dev/null
    prune_backups
  elif ! docker volume inspect "$DB_VOLUME" >/dev/null 2>&1; then
    # The first release on the test stand starts with an empty database; refresh-staging.sh fills it from production.
    echo "==> Creating the database volume $DB_VOLUME"
    docker volume create "$DB_VOLUME" >/dev/null
  fi

  echo "==> Applying migrations"
  APP_TAG=$sha compose run --rm migrate || fail "migrations failed; the app was not switched and still runs $previous"

  echo "==> Starting $IMAGE:$sha"
  docker tag "$IMAGE:$sha" "$IMAGE:$CURRENT_TAG"
  if ! compose up --detach --wait --wait-timeout 120 app; then
    compose logs --tail 50 app >&2 || true
    release_failed "$sha"
  fi

  echo "==> Health check"
  check_health "$sha" || release_failed "$sha"

  if [[ $ENV_NAME == prod ]]; then
    mark_working "$sha"
    prune_images "$sha" "$(last_working_except "$sha")"
  fi
  echo "==> Released $sha to $ENV_NAME"
}

# The version to suggest is the last one that worked, not the one that ran before this deploy:
# after a failed deploy, that one may be broken too.
release_failed() {
  local sha=$1 working
  echo "==> Release of $sha to $ENV_NAME FAILED. Nothing was rolled back: the app stays on $sha." >&2
  [[ $ENV_NAME == prod ]] || exit 1
  working=$(last_working_except "$sha")
  if [[ -n $working ]]; then
    echo "    To return the last working version, a person runs on the server:" >&2
    echo "    sudo -u deploy $DEPLOY_DIR/rollback.sh $working" >&2
  fi
  exit 1
}

# Keeps the newest KEEP_BACKUPS backups. Names start with the UTC time, so name order is time order.
# Only deploys prune: restore.sh never deletes the file it is restoring from.
prune_backups() {
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'prod_*.dump' -printf '%f\n' \
    | sort -r | tail -n +$((KEEP_BACKUPS + 1)) \
    | while read -r name; do rm -f -- "${BACKUP_DIR:?}/$name"; done
}

# After a successful production release keeps only the new version and the last working one before it, for a manual
# rollback. A redeploy of the running version or a deploy after a failed one keeps that working version too.
# The version of the test stand stays as well: removing its commit tag leaves the image under staging-current.
prune_images() {
  local keep_new=$1 keep_working=$2 tag
  for tag in $(image_versions); do
    [[ $tag == "$keep_new" || $tag == "$keep_working" ]] || docker rmi "$IMAGE:$tag" >/dev/null || true
  done
  docker image prune --force >/dev/null
}

read -r -a args <<<"${SSH_ORIGINAL_COMMAND:-}"
case "${args[0]:-}:${#args[@]}" in
  sync:1) sync_scripts ;;
  load:1) load ;;
  release:3) release "${args[1]}" "${args[2]}" ;;
  *) fail "unknown command: ${SSH_ORIGINAL_COMMAND:-<none>} (allowed: sync, load, release prod|staging <sha>)" ;;
esac
