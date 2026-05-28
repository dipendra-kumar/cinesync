#!/usr/bin/env bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo -e "${CYAN}🎬 CineSync — starting server + tunnel${RESET}"

# Start the Node server
cd "$(dirname "$0")/server"
npm start &
SERVER_PID=$!
echo -e "${GREEN}  ✓ Server started (pid $SERVER_PID)${RESET}"

# Give the server a moment before the tunnel connects
sleep 1

# Start cloudflared tunnel
cloudflared tunnel run cinesync &
CF_PID=$!
echo -e "${GREEN}  ✓ Cloudflare tunnel started (pid $CF_PID)${RESET}"

echo -e "${YELLOW}  Press Ctrl+C to stop both${RESET}"

# On exit, kill both cleanly
trap 'echo -e "\n${CYAN}Shutting down…${RESET}"; kill $SERVER_PID $CF_PID 2>/dev/null; wait 2>/dev/null; echo "Stopped."' INT TERM

wait
