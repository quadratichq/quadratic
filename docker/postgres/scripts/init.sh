#!/bin/bash

set -e
set -u

function create_user_and_database() {
    local database=$1
    echo "Creating database '$database' with user '$POSTGRES_USER'"
    psql -c "CREATE DATABASE $database;" || { echo "Failed to create database '$database'"; exit 1; }
    echo "Database '$database' created"
}

if [ -n "$ADDITIONAL_DATABASES" ]; then
    for i in ${ADDITIONAL_DATABASES//,/ }
    do
        create_user_and_database $i
    done
fi
