#!/usr/bin/env bash
# Replaces the production database with a backup. Run by a person on the server, never by a deploy:
#   sudo -u deploy /opt/personal-crm/deploy/restore.sh                lists the backups
#   sudo -u deploy /opt/personal-crm/deploy/restore.sh <backup file>  restores one (a name from the list or a path)
#
# Shows which backup will replace which database and waits for "yes". Then saves a copy of the current
# database, stops the app, drops and recreates the database, loads the backup and starts the app again.
# The app version does not change. If loading fails, the app stays stopped and the script prints
# the command that puts the saved copy back.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# Human sessions do not queue behind a deploy: they stop and ask to try again later.
LOCK_WAIT_SECONDS=0

list_backups() {
  local name
  echo "Backups in $BACKUP_DIR, newest first (time in the name is UTC, then the app version):"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'prod_*.dump' -printf '%f\n' 2>/dev/null | sort -r \
    | while read -r name; do printf '  %6s  %s\n' "$(du -h "$BACKUP_DIR/$name" | cut -f1)" "$name"; done
}

# Backups are written through a pipe, so pg_restore needs them as a file it can seek in, not on stdin.
CONTAINER_COPY=/tmp/restore.dump

# Drops and recreates the database, then loads the backup in one transaction: an error leaves it empty.
recreate_and_load() {
  compose exec -T db sh -c '
    dropdb --username="$POSTGRES_USER" --force --if-exists "$POSTGRES_DB" &&
    createdb --username="$POSTGRES_USER" "$POSTGRES_DB" &&
    pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --exit-on-error --single-transaction "$1"
  ' sh "$CONTAINER_COPY"
}

database_exists() {
  local found
  found=$(compose exec -T db sh -c \
    'psql --username="$POSTGRES_USER" --dbname=postgres --tuples-only --no-align --set=db="$POSTGRES_DB"' \
    <<<"select 1 from pg_database where datname = :'db';") || fail "cannot check whether the database exists"
  [[ $found == 1 ]]
}

require_deploy_user "$@"
if [[ $# -eq 0 ]]; then
  list_backups
  echo
  echo "To restore one: sudo -u deploy $0 <name from the list>"
  exit 0
fi
[[ $# -eq 1 ]] || fail "usage: restore.sh [backup file]"

file=$1
[[ $file == */* ]] || file=$BACKUP_DIR/$file
[[ -f $file ]] || fail "no such backup: $file"
file=$(realpath "$file")

take_lock "$LOCK_WAIT_SECONDS"
compose up --detach --wait db >/dev/null 2>&1 || fail "the database container does not start"
compose exec -T db pg_restore --list <"$file" >/dev/null 2>&1 || fail "$file is not a readable database backup"

database=$(compose exec -T db printenv POSTGRES_DB)
running=$(app_version)
backup_version=$(basename "$file" | sed -nE 's/^prod_[0-9-]+_[0-9-]+_([0-9a-f]{40}|none)(_.*)?\.dump$/\1/p')

cat <<EOF

The production database will be DELETED and loaded again from a backup.

  Backup file:      $file
  Size, saved at:   $(du -h "$file" | cut -f1), $(date -u -r "$file" '+%Y-%m-%d %H:%M UTC')
  Backup version:   ${backup_version:-unknown, not in the file name}

  Database:         "$database", stack "prod" on $(hostname)
  App version now:  $running (stays the same)

A copy of the current database is saved to $BACKUP_DIR first.
The app is stopped while the backup loads (about a minute).

EOF
if [[ $backup_version != "$running" ]]; then
  echo "WARNING: the backup was saved with app version ${backup_version:-unknown}, but $running runs now."
  echo "         If their database structure differs, the app may fail after the restore."
  echo "         To match them, cancel and switch the app first: sudo -u deploy $DEPLOY_DIR/rollback.sh"
  echo
fi
confirm

if database_exists; then
  echo "==> Saving a copy of the current database"
  saved=$("$DEPLOY_DIR/backup.sh" before-restore)
else
  echo "==> Database \"$database\" does not exist, nothing to copy"
  saved=""
fi

echo "==> Copying the backup into the database container"
compose exec -T db sh -c 'cat >"$1"' sh "$CONTAINER_COPY" <"$file"

echo "==> Stopping the app"
compose stop app

echo "==> Deleting database \"$database\", creating it again and loading the backup"
if ! recreate_and_load; then
  compose exec -T db rm -f "$CONTAINER_COPY" || true
  echo >&2
  echo "RESTORE FAILED. The app is stopped; database \"$database\" is empty or incomplete." >&2
  if [[ -n $saved ]]; then
    echo "The copy saved before this restore: $saved" >&2
    echo "To put it back, run: sudo -u deploy $0 $(basename "$saved")" >&2
  fi
  exit 1
fi
compose exec -T db rm -f "$CONTAINER_COPY"

echo "==> Starting the app ($running)"
compose up --detach --wait --wait-timeout 120 app || {
  compose logs --tail 50 app >&2 || true
  fail "the database is restored, but the app does not start"
}
check_health "$running" || fail "the database is restored, but the health check failed"
echo "==> Restored from $file"
