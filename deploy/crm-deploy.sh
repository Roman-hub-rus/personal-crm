#!/usr/bin/env bash
# Forced command of the GitHub Actions deploy key: ~deploy/.ssh/authorized_keys runs this script
# (/opt/personal-crm/deploy/crm-deploy.sh) on every connection with that key, and the command the client
# asked for arrives in SSH_ORIGINAL_COMMAND. Nothing else can be run with the key: restore.sh and
# rollback.sh are only for a person logged in to the server.
#
# Allowed commands:
#   sync                  replace /opt/personal-crm/deploy with the repo's deploy/ folder (gzipped tar on stdin)
#   load                  read a gzipped `docker save` archive of personal-crm:<sha> from stdin
#   has-image <sha>       print "yes" if personal-crm:<sha> is on the server, "no" if not
#   release staging <sha> the test stand: apply migrations with personal-crm:<sha>, switch the app to it
#   release prod <sha>    production: back up the database, then the same
#   release prod rollback production: back up the database and switch the app back to the version that worked
#                         before the current one (no migrations: they never run backwards)
#
# The deploy to the test stand runs on every merge to main (deploy-staging.yml), the deploy to production only when
# a person starts "Deploy prod" (deploy-prod.yml). A failed release is not rolled back: the deploy goes red and a person decides.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# A deploy waits this long for a restore or rollback that a person is running.
LOCK_WAIT_SECONDS=600
# After a production release, app images built earlier than this are removed (except the versions that must stay).
KEEP_IMAGE_DAYS=14

# Daily production backup: cron runs daily-backup.sh every hour and the script itself picks the 03:00 hour in Moscow.
# The marker at the end of the line (a shell comment for cron) lets a deploy find and replace only its own line:
# other lines of the deploy user's crontab stay as they are.
CRON_MARK='# personal-crm daily backup'
CRON_LINE="0 * * * * $DEPLOY_DIR/daily-backup.sh --scheduled 2>&1 | logger --tag crm-backup $CRON_MARK"

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

  [[ -x $new/crm-deploy.sh && -x $new/daily-backup.sh && -f $new/lib.sh && -f $new/compose.yml ]] \
    || fail "crm-deploy.sh, daily-backup.sh, lib.sh or compose.yml is missing; scripts on the server left as they were"
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

has_image() {
  [[ $1 =~ ^[0-9a-f]{40}$ ]] || fail "has-image expects a full commit SHA"
  if docker image inspect "$IMAGE:$1" >/dev/null 2>&1; then echo yes; else echo no; fi
}

# Every release makes sure the daily backup is in the crontab, so a new server or a changed line needs no manual step.
install_backup_schedule() {
  local current
  current=$(crontab -l 2>/dev/null) || current=""
  if grep --quiet --line-regexp --fixed-strings -- "$CRON_LINE" <<<"$current"; then return 0; fi
  {
    if [[ -n $current ]]; then grep --invert-match --fixed-strings -- "$CRON_MARK" <<<"$current" || true; fi
    echo "$CRON_LINE"
  } | crontab - || fail "cannot add the daily backup to the crontab of $(id -un)"
  echo "==> Daily backup of production added to the crontab of $(id -un)"
}

# One script for both environments; only production backs up the database first, keeps track of working versions,
# can roll back and removes old images.
release() {
  local sha=$2 previous rollback=false
  use_env "$1"
  [[ $sha =~ ^[0-9a-f]{40}$ || ($sha == rollback && $ENV_NAME == prod) ]] \
    || fail "release expects a full commit SHA, or \"rollback\" for prod"
  [[ -f $ENV_FILE ]] || fail "$ENV_FILE is missing: the owner writes it once (see README)"
  take_lock "$LOCK_WAIT_SECONDS"
  install_backup_schedule
  previous=$(app_version)

  if [[ $ENV_NAME == prod ]]; then
    # Servers deployed before the list of working versions existed: the version that runs now counts as working
    # if it answers the health check. Once the list exists, only successful releases and rollbacks add to it.
    if [[ ! -f $WORKING_VERSIONS && $previous != none ]] && check_health "$previous" >/dev/null 2>&1; then
      mark_working "$previous"
    fi
  fi
  # The version before the current one is the newest working version other than the one that runs now:
  # after a failed deploy that is the version that ran before it.
  if [[ $sha == rollback ]]; then
    rollback=true
    sha=$(last_working_except "$previous")
    [[ -n $sha ]] || fail "no earlier working production version is on the server; nothing was changed"
  fi
  docker image inspect "$IMAGE:$sha" >/dev/null 2>&1 || fail "image $IMAGE:$sha is not loaded"

  echo "==> Environment: $ENV_NAME, app version before this deploy: $previous"
  if [[ $rollback == true ]]; then
    echo "==> Deploying $sha (rollback to the version before the current one)"
  else
    echo "==> Deploying $sha"
  fi

  if [[ $ENV_NAME == prod ]]; then
    echo "==> Backing up the database"
    "$DEPLOY_DIR/backup.sh" >/dev/null
    prune_backups ""
    prune_backups before-restore
  elif ! docker volume inspect "$DB_VOLUME" >/dev/null 2>&1; then
    # The first release on the test stand starts with an empty database; refresh-staging.sh fills it from production.
    echo "==> Creating the database volume $DB_VOLUME"
    docker volume create "$DB_VOLUME" >/dev/null
  fi

  if [[ $rollback == true ]]; then
    echo "==> Skipping migrations: the database stays as it is"
  else
    echo "==> Applying migrations"
    APP_TAG=$sha compose run --rm migrate || fail "migrations failed; the app was not switched and still runs $previous"
  fi

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
    echo "==> Removing app images built more than $KEEP_IMAGE_DAYS days ago"
    prune_images "$sha" "$(last_working_except "$sha")" "$(staging_version)"
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
    echo "    To return the last working version $working: run Deploy prod with \"rollback\" checked," >&2
    echo "    or on the server: sudo -u deploy $DEPLOY_DIR/rollback.sh $working" >&2
  fi
  exit 1
}

# The version the test stand runs now; "none" if it has none yet.
staging_version() {
  (
    use_env staging
    app_version
  )
}

# Removes app images built more than KEEP_IMAGE_DAYS days ago. The given versions always stay: production now,
# the production version before it (for a rollback) and the test stand now. Newer images all stay.
# Only images of this app are touched: the server is shared with other projects.
# Usage: prune_images <version to keep>...
prune_images() {
  local keep=" $* " cutoff tag created
  cutoff=$(date -u -d "$KEEP_IMAGE_DAYS days ago" +%s)
  for tag in $(image_versions); do
    [[ $keep != *" $tag "* ]] || continue
    created=$(docker image inspect --format '{{.Created}}' "$IMAGE:$tag") || continue
    if (($(date -u -d "$created" +%s) < cutoff)); then
      docker rmi "$IMAGE:$tag" >/dev/null && echo "    removed $tag" || true
    fi
  done
}

read -r -a args <<<"${SSH_ORIGINAL_COMMAND:-}"
case "${args[0]:-}:${#args[@]}" in
  sync:1) sync_scripts ;;
  load:1) load ;;
  has-image:2) has_image "${args[1]}" ;;
  release:3) release "${args[1]}" "${args[2]}" ;;
  *) fail "unknown command: ${SSH_ORIGINAL_COMMAND:-<none>} (allowed: sync, load, has-image <sha>, release prod|staging <sha>, release prod rollback)" ;;
esac
