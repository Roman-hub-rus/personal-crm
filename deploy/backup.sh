#!/usr/bin/env bash
# Dumps the production database to /opt/personal-crm/backups/prod_<UTC time>_<app version>[_<label>].dump.
# The version in the name is the one the app container has now, so a backup taken by a deploy is named
# after the version that ran before it: that is the app version the backup's data and schema belong to.
#
# Run by crm-deploy.sh release (the first step of every deploy) and by restore.sh (a copy before restoring).
# Callers hold the deploy lock. Progress goes to stderr; the path of the new backup is printed to stdout.
#
# Usage: backup.sh [label]
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

label=${1:-}
[[ $# -le 1 && ( -z $label || $label =~ ^[a-z0-9-]+$ ) ]] || fail "usage: backup.sh [label of a-z, 0-9 and -]"

version=$(app_version)
name="prod_$(date -u +%Y-%m-%d_%H-%M-%S)_${version}${label:+_$label}.dump"
file=$BACKUP_DIR/$name
partial=$BACKUP_DIR/.$name.partial

umask 077
mkdir -p "$BACKUP_DIR"
trap 'rm -f "$partial"' EXIT

compose up --detach --wait db >&2
# pg_dump runs inside the db container, which already knows the user and the database name.
compose exec -T db sh -c 'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' >"$partial" \
  || fail "pg_dump failed"
compose exec -T db pg_restore --list <"$partial" >/dev/null || fail "the new dump cannot be read back"
mv "$partial" "$file"

echo "Backup saved: $file ($(du -h "$file" | cut -f1))" >&2
echo "$file"
