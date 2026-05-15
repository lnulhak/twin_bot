#!/usr/bin/env bash
# Wipes the local database and all session state so you can start fresh.
# Only for development — do not run in production.
set -e

echo "Resetting Echo Twin..."

# Remove SQLite database
rm -f echo-twin.db echo-twin.db-journal

# Remove session and offset state files
rm -f .onboarding-session.json .telegram-offset

# Re-run migrations to create a fresh DB
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init

echo "Done. Start npm run dev and send /start to your Telegram bot."
