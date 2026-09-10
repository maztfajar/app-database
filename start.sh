#!/usr/bin/env bash

# ==============================================================================
#  App Database — Startup Script
#  Dibuat oleh Fajar Wahyudi
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Text styling
BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
PURPLE="\033[0;35m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${PURPLE}${BOLD}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║             ⚡ APP DATABASE ⚡                ║"
echo "  ║      Web-based Database Client (Beekeeper)    ║"
echo "  ║         Dibuat oleh Fajar Wahyudi             ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${RESET}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js tidak ditemukan! Silakan install Node.js terlebih dahulu.${RESET}"
    exit 1
fi

# Check backend dependencies
if [ ! -d "$DIR/backend/node_modules" ]; then
    echo -e "${YELLOW}[1/3] Menginstall dependencies Backend...${RESET}"
    (cd "$DIR/backend" && npm install)
else
    echo -e "${GREEN}[1/3] Dependencies Backend siap.${RESET}"
fi

# Check frontend dependencies
if [ ! -d "$DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}[2/3] Menginstall dependencies Frontend...${RESET}"
    (cd "$DIR/frontend" && npm install)
else
    echo -e "${GREEN}[2/3] Dependencies Frontend siap.${RESET}"
fi

echo -e "${CYAN}[3/3] Menjalankan Backend & Frontend...${RESET}"

# Function to clean up background processes on exit (Ctrl+C)
cleanup() {
    echo -e "\n${YELLOW}Menghentikan App Database...${RESET}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null
    fi
    wait "$BACKEND_PID" 2>/dev/null
    wait "$FRONTEND_PID" 2>/dev/null
    echo -e "${GREEN}Aplikasi berhasil dihentikan. Sampai jumpa!${RESET}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start backend
cd "$DIR/backend"
node server.js &
BACKEND_PID=$!

# Start frontend
cd "$DIR/frontend"
npx vite --host &
FRONTEND_PID=$!

# Wait briefly for servers to boot
sleep 2

echo -e "\n${GREEN}${BOLD}✓ Aplikasi Berhasil Berjalan!${RESET}"
echo -e "  ➜  ${CYAN}Frontend UI :${RESET} ${BOLD}http://localhost:5173${RESET}"
echo -e "  ➜  ${CYAN}Backend API :${RESET} ${BOLD}http://localhost:3001${RESET}"
echo -e "\n${YELLOW}Tekan ${BOLD}Ctrl + C${RESET}${YELLOW} untuk menghentikan aplikasi.${RESET}\n"

# Open browser if possible
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:5173" &> /dev/null &
elif command -v sensible-browser &> /dev/null; then
    sensible-browser "http://localhost:5173" &> /dev/null &
fi

# Keep script running and wait for background processes
wait
