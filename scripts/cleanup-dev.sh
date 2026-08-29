#!/bin/bash

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Stop stale AutoSSL dev Electron processes so old main handlers cannot serve a new Vite renderer.
pkill -f "$APP_DIR/node_modules/.bin/electron" || true
pkill -f "$APP_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" || true
