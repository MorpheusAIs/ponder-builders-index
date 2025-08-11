#!/bin/bash
set -e
set -u

# This script creates multiple databases for different Ponder apps
# Based on the POSTGRES_MULTIPLE_DATABASES environment variable

function create_user_and_database() {
    local database=$1
    echo "Creating user and database '$database'"
    
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        CREATE DATABASE $database;
        GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;
EOSQL
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        # Skip if it's the main database (already created)
        if [ "$db" != "$POSTGRES_DB" ]; then
            create_user_and_database $db
        fi
    done
    echo "Multiple databases created"
fi
