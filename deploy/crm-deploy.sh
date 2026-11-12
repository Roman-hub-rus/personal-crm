#!/usr/bin/env bash
# Forced command of the GitHub Actions deploy key: ~deploy/.ssh/authorized_keys runs this script
# (/opt/personal-crm/deploy/crm-deploy.sh) on every connection with that key, and the command the client
# asked for arrives in SSH_ORIGINAL_COMMAND. Nothing else can be run with the key: restore.sh and
# rollback.sh are only for a person logged in to the server.
#
# Allowed commands:
#   sync            replace /opt/personal-crm/deploy with the repo's deploy/ folder (gzipped tar on stdin)
#   load            read a gzipped `docker save` archive of personal-crm:<sha> from stdin
#   release <sha>   back up the database, apply migrations with personal-crm:<sha>, switch the app to it
#
# A failed release is not rolled back: the deploy goes red and a person decides (see rollback.sh).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

KEEP_BACKUPS=10
# A deploy waits this long for a restore or rollback that a person is running.
LOCK_WAIT_SECONDS=600

# The new folder is checked before it replaces the old one, so a broken script or compose file
# never becomes the forced command or the stack definition.
sync_scripts() {
  local new=$STACK_DIR/deploy.new old=$STACK_DIR/deploy.old script
  take_lock "$LOCK_WAIT_SECONDS"
  rm -rf "$new" "$old"
  mkdir "$new"
  tar --extract --gzip --no-same-owner --directory "$new"

  [[ -x $new/crm-deploy.sh && -f $new/lib.sh && -f $new/compose.yml ]] \
    || fail "crm-deploy.sh, lib.sh or compose.yml is missing; scripts on the server left as they were"
  for script in "$new"/*.sh; do
    bash -n "$script" || fail "syntax error in $(basename "$script"); scripts on the server left as they were"
  done
  docker compose --project-name prod --file "$new/compose.yml" --env-file "$STACK_DIR/.env" config --quiet \
    || fail "compose.yml is invalid; scripts on the server left as they were"

  # The running copy of this script keeps reading its old file, which stays readable until it exits.
  if [[ -d $DEPLOY_DIR ]]; then mv "$DEPLOY_DIR" "$old"; fi
  mv "$new" "$DEPLOY_DIR"
  rm -rf "$old"
  echo "==> Deploy scripts updated"
}

load() {
  gunzip | docker load
}

release() {
  local sha=$1 previous
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || fail "release expects a full commit SHA"
  docker image inspect "$IMAGE:$sha" >/dev/null 2>&1 || fail "image $IMAGE:$sha is not loaded"
  take_lock "$LOCK_WAIT_SECONDS"
  previous=$(app_version)

  # Servers deployed before the list of working versions existed: the version that runs now counts as working
  # if it answers the health check. Once the list exists, only successful releases and rollbacks add to it.
  if [[ ! -f $WORKING_VERSIONS && $previous != none ]] && check_health "$previous" >/dev/null 2>&1; then
    mark_working "$previous"
  fi

  echo "==> Backing up the database (app version before this deploy: $previous)"
  "$DEPLOY_DIR/backup.sh" >/dev/null
  prune_backups

  echo "==> Applying migrations"
  APP_TAG=$sha compose run --rm migrate || fail "migrations failed; the app was not switched and still runs $previous"

  echo "==> Starting $IMAGE:$sha"
  docker tag "$IMAGE:$sha" "$IMAGE:current"
  if ! compose up --detach --wait --wait-timeout 120 app; then
    compose logs --tail 50 app >&2 || true
    release_failed "$sha"
  fi

  echo "==> Health check"
  check_health "$sha" || release_failed "$sha"

  mark_working "$sha"
  prune_images "$sha" "$(last_working_except "$sha")"
  echo "==> Released $sha"
}

# The version to suggest is the last one that worked, not the one that ran before this deploy:
# after a failed deploy, that one may be broken too.
release_failed() {
  local sha=$1 working
  working=$(last_working_except "$sha")
  echo "==> Release of $sha FAILED. Nothing was rolled back: the app stays on $sha." >&2
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

# After a successful release keeps only the new version and the last working one before it, for a manual rollback.
# A redeploy of the running version or a deploy after a failed one keeps that working version too.
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
  release:2) release "${args[1]}" ;;
  *) fail "unknown command: ${SSH_ORIGINAL_COMMAND:-<none>} (allowed: sync, load, release <sha>)" ;;
esac
