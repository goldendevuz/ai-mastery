#!/usr/bin/env bash
# Run on the server from the repo root: pulls, builds the SPA, installs backend deps, restarts the service.
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
npm ci
npm run build
[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/pip install -q -r backend/requirements.txt
systemctl --user restart ai-mastery
