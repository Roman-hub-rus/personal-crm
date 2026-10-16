#!/usr/bin/env bash
# Forced command of the GitHub Actions deploy key: ~deploy/.ssh/authorized_keys runs this script
# on every connection, and the command the client asked for arrives in SSH_ORIGINAL_COMMAND.
# Installed by hand to /usr/local/bin/crm-deploy (owner root), so the deploy key cannot change it.
#
# Allowed commands:
#   load            read a gzipped `docker save` archive of personal-crm:<sha> from stdin
#   release <sha>   apply migrations with personal-crm:<sha>, then switch the app to it
set -euo pipefail

STACK_DIR=/opt/personal-crm
IMAGE=personal-crm
KEEP_RELEASES=3
HEALTH_URL=http://127.0.0.1:3000/health

fail() {
  echo "crm-deploy: $*" >&2
  exit 1
}

load() {
  gunzip | docker load
}

release() {
  local sha=$1 previous health
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || fail "release expects a full commit SHA"
  docker image inspect "$IMAGE:$sha" >/dev/null 2>&1 || fail "image $IMAGE:$sha is not loaded"
  cd "$STACK_DIR"

  echo "==> Applying migrations"
  APP_TAG=$sha docker compose run --rm migrate

  echo "==> Starting $IMAGE:$sha"
  previous=$(docker image inspect --format '{{.Id}}' "$IMAGE:current" 2>/dev/null || true)
  docker tag "$IMAGE:$sha" "$IMAGE:current"
  if ! docker compose up --detach --wait --wait-timeout 120 app; then
    docker compose logs --tail 50 app >&2 || true
    if [[ -n $previous ]]; then
      echo "==> New version is unhealthy, rolling back to the previous one" >&2
      docker tag "$previous" "$IMAGE:current"
      docker compose up --detach --wait --wait-timeout 120 app || true
    fi
    fail "release of $sha failed"
  fi

  echo "==> Health check"
  health=$(curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-all-errors "$HEALTH_URL")
  echo "$health"
  [[ $health == *"\"version\":\"$sha\""* ]] || fail "health check reports another version"

  prune
  echo "==> Released $sha"
}

# Keeps the newest few versions for a manual rollback and removes older ones.
prune() {
  docker images "$IMAGE" --format '{{.CreatedAt}}|{{.Tag}}' \
    | sort -r | cut -d'|' -f2 | grep -E '^[0-9a-f]{40}$' | tail -n +$((KEEP_RELEASES + 1)) \
    | while read -r tag; do docker rmi "$IMAGE:$tag" >/dev/null || true; done
  docker image prune --force >/dev/null
}

read -r -a args <<<"${SSH_ORIGINAL_COMMAND:-}"
case "${args[0]:-}:${#args[@]}" in
  load:1) load ;;
  release:2) release "${args[1]}" ;;
  *) fail "unknown command: ${SSH_ORIGINAL_COMMAND:-<none>} (allowed: load, release <sha>)" ;;
esac
