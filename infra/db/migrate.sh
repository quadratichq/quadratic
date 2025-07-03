#!/bin/bash
set -euo pipefail

# Install PostgreSQL official APT repository for multiple versions
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

# Install required packages with specific versions
sudo apt update
sudo apt install postgresql-client-common postgresql-client-15 postgresql-client-17 -y

# Set default pg_dump and pg_restore to use version 17 (latest)
export PATH="/usr/lib/postgresql/17/bin:$PATH"

# Database connection strings
export HEROKU_DATABASE_URL="postgres://user:pass@host:port/db"
export AWS_DATABASE_URL="postgres://user:pass@host:port/db"

# Local dump file with timestamp
HEROKU_DUMP_FILE="heroku_dump_$(date +%Y%m%d_%H%M%S).tar"
LOG_FILE="migration_$(date +%Y%m%d_%H%M%S).log"

# Function to calculate and display duration
show_duration() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo "Time taken: $((duration / 60)) minutes and $((duration % 60)) seconds" | tee -a "$LOG_FILE"
}

# Validate environment variables
if [[ -z "${HEROKU_DATABASE_URL:-}" ]]; then
    echo "ERROR: HEROKU_DATABASE_URL environment variable is not set"
    exit 1
fi

if [[ -z "${AWS_DATABASE_URL:-}" ]]; then
    echo "ERROR: AWS_DATABASE_URL environment variable is not set"
    exit 1
fi

# Remove existing dump file if it exists
if [[ -f "$HEROKU_DUMP_FILE" ]]; then
    echo "Removing existing dump file: $HEROKU_DUMP_FILE"
    rm "$HEROKU_DUMP_FILE"
fi

# Verify connections before starting
echo "Testing database connections..." | tee -a "$LOG_FILE"
if ! timeout 30 pg_isready -d "$HEROKU_DATABASE_URL" >/dev/null 2>&1; then
    echo "Error: Cannot connect to Heroku database" | tee -a "$LOG_FILE"
    exit 1
fi

if ! timeout 30 pg_isready -d "$AWS_DATABASE_URL" >/dev/null 2>&1; then
    echo "Error: Cannot connect to AWS database" | tee -a "$LOG_FILE"
    exit 1
fi

echo "✓ Database connections verified" | tee -a "$LOG_FILE"

echo "Starting dump from Heroku..." | tee -a "$LOG_FILE"
start_time=$(date +%s)
pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --verbose \
    --dbname="$HEROKU_DATABASE_URL" \
    --file="$HEROKU_DUMP_FILE" 2>>"$LOG_FILE"

echo "✓ Heroku dump completed: $HEROKU_DUMP_FILE" | tee -a "$LOG_FILE"
show_duration $start_time

# Check if dump file was created and has content
if [[ ! -f "$HEROKU_DUMP_FILE" ]] || [[ ! -s "$HEROKU_DUMP_FILE" ]]; then
    echo "Error: Dump file is missing or empty" | tee -a "$LOG_FILE"
    exit 1
fi

file_size=$(du -h "$HEROKU_DUMP_FILE" | cut -f1)
echo "✓ Dump file verified (Size: $file_size)" | tee -a "$LOG_FILE"

echo "Restoring dump into AWS Postgres..." | tee -a "$LOG_FILE"
start_time=$(date +%s)
pg_restore \
    --clean \
    --if-exists \
    --verbose \
    --no-owner \
    --no-privileges \
    --single-transaction \
    --dbname="$AWS_DATABASE_URL" \
    "$HEROKU_DUMP_FILE" 2>>"$LOG_FILE"

echo "✓ Restore completed." | tee -a "$LOG_FILE"
show_duration $start_time
