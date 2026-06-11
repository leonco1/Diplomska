#!/bin/bash
# This script is called by docker-entrypoint to update auth after initialization
set -e

# Wait for Postgres to be ready
until pg_isready -U postgres; do
  echo 'waiting for postgres...'
  sleep 1
done

# Update pg_hba.conf to allow password auth from all sources
cat >> "$PGDATA/pg_hba.conf" <<EOF

# Allow password auth from anywhere (for demo/dev)
host    all             all             0.0.0.0/0               md5
host    all             all             ::/0                    md5
EOF

# Reload Postgres config
pg_ctl reload -D "$PGDATA" || true

echo "Auth configured"
