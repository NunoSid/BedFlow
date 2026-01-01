#!/usr/bin/env bash
set -euo pipefail

echo "Starting BedFlow..."

if [ ! -f "server/node_modules/.bin/prisma" ] || [ ! -f "server/node_modules/.bin/prisma_schema_build_bg.wasm" ]; then
  echo "Installing server dependencies..."
  rm -rf server/node_modules
  npm --prefix server install
fi

if [ ! -d "client/node_modules" ] || [ ! -f "client/node_modules/vite/dist/node/cli.js" ]; then
  echo "Installing client dependencies..."
  rm -rf client/node_modules
  npm --prefix client install
fi

echo "Preparing database..."
npm --prefix server run -s prisma:push
npm --prefix server run -s prisma:seed

echo "Starting backend (http://localhost:1893)..."
npm --prefix server run start:dev &
SERVER_PID=$!

echo "Starting frontend..."
npm --prefix client run dev &
CLIENT_PID=$!

trap 'kill $SERVER_PID $CLIENT_PID' EXIT
wait
