#!/usr/bin/env bash
# Daily backup of the production database: /opt/personal-crm/backups/prod_<UTC time>_<app version>_daily.dump.
# Keeps the newest daily backups (KEEP_BACKUPS in lib.sh); backups taken by deploys and restores are counted apart.
#
#   daily-backup.sh --scheduled   run by cron every hour (a deploy puts the line in the deploy user's crontab, see
#                                 crm-deploy.sh): backs up only in the 03:00 hour Moscow time, otherwise does nothing.
#                                 The output goes to the server journal: journalctl -t crm-backup
#   daily-backup.sh               run by a person: backs up right away
#                                 (sudo -u deploy /opt/personal-crm/deploy/daily-backup.sh)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
use_env prod

# A running deploy, restore or rollback of production finishes first; a long one may take a while.
LOCK_WAIT_SECONDS=1800

case "$*" in
  --scheduled)
    # Moscow time is UTC+3 all year round. A fixed offset works whatever the time zone of the server
    # and whether or not it has time zone data.
    [[ $(TZ=MSK-3 date +%H) == 03 ]] || exit 0
    ;;
  "") ;;
  *) fail "usage: daily-backup.sh [--scheduled]" ;;
esac

require_deploy_user "$@"
[[ -f $ENV_FILE ]] || fail "$ENV_FILE is missing: the owner writes it once (see README)"
take_lock "$LOCK_WAIT_SECONDS"

"$DEPLOY_DIR/backup.sh" daily >/dev/null
prune_backups daily
