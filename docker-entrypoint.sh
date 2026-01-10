#!/bin/sh
set -e

echo "🔄 Waiting for PostgreSQL to be ready..."
until node -e "
const { Client } = require('pg');
const client = new Client({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});
client.connect()
  .then(() => { client.end(); process.exit(0); })
  .catch(() => process.exit(1));
" 2>/dev/null; do
  echo "⏳ PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready!"

echo "🚀 Running database migrations..."
npm run migration:run || echo "⚠️  Migration failed or no pending migrations"

echo "🎯 Starting application..."
exec "$@"
