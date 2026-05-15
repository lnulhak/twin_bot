#!/usr/bin/env bash
set -e
TARGET="$HOME/.openclaw/skills/echo-twin"
mkdir -p "$TARGET"
cp -r src/openclaw-skill/echo-twin/* "$TARGET/"
echo "Echo Twin skill installed to $TARGET"
echo "Remember to set ECHO_TWIN_API_URL in your OpenClaw env (e.g. http://localhost:3000)"
