#!/bin/bash
SOCK="$HOME/.crayfish-farm/crayfish-farm.sock"
if [ -S "$SOCK" ]; then
  echo '{"jsonrpc":"2.0","id":0,"method":"hook.event","params":{"event":"session-start","ts":'$(date +%s)'}}' | nc -U -w1 "$SOCK" 2>/dev/null
else
  echo '{"event":"session-start","ts":'$(date +%s)'}' >> "$HOME/.crayfish-farm/events.jsonl"
fi
