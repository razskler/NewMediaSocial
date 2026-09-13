#!/bin/bash
# Runs once on first boot of the Postgres container (empty data volume).
# Provisions what Supabase Auth (GoTrue) expects to find, mirroring the
# official Supabase self-hosting setup:
#   - a dedicated login role that owns the auth schema
#   - the "auth" schema itself (GoTrue never creates it)
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
CREATE ROLE supabase_auth_admin LOGIN PASSWORD '${POSTGRES_PASSWORD}' NOINHERIT;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = 'auth';
EOSQL
