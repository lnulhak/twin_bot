#!/bin/bash
launchctl load ~/Library/LaunchAgents/ai.echotwin.telegram-poll.plist
trap "launchctl unload ~/Library/LaunchAgents/ai.echotwin.telegram-poll.plist" EXIT
npm run dev
