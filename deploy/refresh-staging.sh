#!/usr/bin/env bash
# Replaces the database of the test stand with a copy of production taken from the newest production backup.
# Run by a person on the server, never by a deploy:
#   sudo -u deploy /opt/personal-crm/deploy/refresh-staging.sh
#
# Production is not touched: only its newest backup file is read. Shows which backup will replace which
# database and waits for "yes". Then stops the app of the test stand, drops and recreates its database,
# loads the backup, applies the migrations of the version the test stand runs (the backup may be older)
# and starts the app again. Used once after the first deploy of the test stand and whenever its data is spoiled.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
use_env staging

# Human sessions do not queue behind a deploy: they stop and ask to try again later.
LOCK_WAIT_SECONDS=0
# Backups are written through a pipe, so pg_restore needs them as a file it can seek in, not on stdin.
CONTAINER_COPY=/tmp/refresh.dump

# Drops and recreates the database, then loads the backup in one transaction: an error leaves it empty.
# The production owner and grants are skipped: the test stand has its own database user.
recreate_and_load() {
  compose exec -T db sh -c '
    dropdb --username="$POSTGRES_USER" --force --if-exists "$POSTGRES_DB" &&
    createdb --username="$POSTGRES_USER" "$POSTGRES_DB" &&
    pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner --no-acl \
      --exit-on-error --single-transaction "$1"
  ' sh "$CONTAINER_COPY"
}

require_deploy_user "$@"
[[ $# -eq 0 ]] || fail "usage: refresh-staging.sh (it always takes the newest production backup)"
[[ -f $ENV_FILE ]] || fail "$ENV_FILE is missing: the owner writes it once (see README)"

take_lock "$LOCK_WAIT_SECONDS"
running=$(app_version)
[[ $running != none ]] || fail "the test stand has no app yet: a merge to main deploys it first"

name=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'prod_*.dump' -printf '%f\n' 2>/dev/null | sort -r | head -n 1)
[[ -n $name ]] || fail "there are no production backups in $BACKUP_DIR"
file=$BACKUP_DIR/$name

compose up --detach --wait db >/dev/null 2>&1 || fail "the database container of the test stand does not start"
compose exec -T db pg_restore --list <"$file" >/dev/null 2>&1 || fail "$file is not a readable database backup"
database=$(compose exec -T db printenv POSTGRES_DB)

cat <<EOF

The database of the TEST STAND will be DELETED and loaded again from the newest production backup.
Production is not changed.

  Backup file:      $file
  Size, saved at:   $(du -h "$file" | cut -f1), $(date -u -r "$file" '+%Y-%m-%d %H:%M UTC')

  Database:         "$database", stack "$ENV_NAME" on $(hostname)
  App version now:  $running (stays the same; its migrations run after loading)

The app of the test stand is stopped while the backup loads (about a minute).

EOF
confirm

echo "==> Copying the backup into the database container"
compose exec -T db sh -c 'cat >"$1"' sh "$CONTAINER_COPY" <"$file"

echo "==> Stopping the app"
compose stop app

echo "==> Deleting database \"$database\", creating it again and loading the backup"
if ! recreate_and_load; then
  compose exec -T db rm -f "$CONTAINER_COPY" || true
  fail "loading failed. The app of the test stand is stopped; run this script again"
fi
compose exec -T db rm -f "$CONTAINER_COPY"

echo "==> Applying migrations of $running"
compose run --rm migrate || fail "migrations failed. The app of the test stand is stopped"

echo "==> Starting the app ($running)"
compose up --detach --wait --wait-timeout 120 app || {
  compose logs --tail 50 app >&2 || true
  fail "the database is loaded, but the app does not start"
}
check_health "$running" >/dev/null || fail "the database is loaded, but the health check failed"
echo "==> The test stand now has the data of $name"
