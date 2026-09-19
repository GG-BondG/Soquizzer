#!/usr/bin/env bash
# 一键启动 / One-click launcher for Soquizzer.
#
#   ./start.sh          后端 + 桌面应用 (Electron) / backend + desktop app
#   ./start.sh --web    后端 + 浏览器版 (http://localhost:5173) / backend + browser build
#
# First run also sets everything up: Python venv, backend deps, .env, npm install, Live2D files.
# Later runs skip whatever is already done. Press Ctrl+C to stop both processes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_PORT=8000
FRONTEND_PORT=5173
BACKEND_LOG="$BACKEND/backend.log"

MODE=desktop
case "${1:-}" in
  "") ;;
  --web) MODE=web ;;
  -h|--help) sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
esac

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mxx  %s\033[0m\n' "$*" >&2; exit 1; }

# ---------- 0. 检查环境 / Preflight ----------
command -v python3 >/dev/null || die "找不到 python3,请先安装 Python 3.11+ / python3 not found, install Python 3.11+"
command -v node    >/dev/null || die "找不到 node,请先安装 Node.js 20.19+ 或 22.12+ / node not found, install Node.js 20.19+ or 22.12+"
command -v npm     >/dev/null || die "找不到 npm / npm not found"
command -v curl    >/dev/null || die "找不到 curl / curl not found"

port_in_use() {
  command -v lsof >/dev/null && lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}
for p in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  port_in_use "$p" && die "端口 $p 已被占用,请先关掉占用它的程序 / port $p is already in use — stop whatever is using it first (lsof -nP -iTCP:$p -sTCP:LISTEN)"
done

# ---------- 1. 后端准备 / Backend setup ----------
say "准备后端 / Preparing backend"
PYTHON="$BACKEND/.venv/bin/python"
[[ -x "$PYTHON" ]] || python3 -m venv "$BACKEND/.venv"

# Reinstall only when requirements.txt changed since the last successful install.
STAMP="$BACKEND/.venv/.requirements-hash"
REQ_HASH="$(shasum "$BACKEND/requirements.txt" | cut -d' ' -f1)"
if [[ ! -f "$STAMP" || "$(cat "$STAMP")" != "$REQ_HASH" ]]; then
  echo "安装 Python 依赖(首次会比较慢) / Installing Python dependencies (slow on first run)..."
  "$PYTHON" -m pip install -q --disable-pip-version-check -r "$BACKEND/requirements.txt"
  echo "$REQ_HASH" > "$STAMP"
fi

[[ -f "$BACKEND/.env" ]] || cp "$BACKEND/.env.example" "$BACKEND/.env"
if ! grep -Eq '^(GEMINI_API_KEY|GOOGLE_API_KEY)=.+' "$BACKEND/.env"; then
  if [[ -t 0 ]]; then
    echo "需要 Gemini API Key(在 https://aistudio.google.com/apikey 申请)"
    echo "A Gemini API key is needed (get one at https://aistudio.google.com/apikey)"
    read -r -s -p "GEMINI_API_KEY (输入不会显示 / input is hidden): " KEY; echo
    if [[ -n "$KEY" ]]; then
      GEMINI_KEY="$KEY" awk '/^GEMINI_API_KEY=/ { print "GEMINI_API_KEY=" ENVIRON["GEMINI_KEY"]; next } { print }' \
        "$BACKEND/.env" > "$BACKEND/.env.tmp" && mv "$BACKEND/.env.tmp" "$BACKEND/.env"
    fi
  fi
  # The backend refuses to start without a key, so stop here instead of failing later.
  grep -Eq '^(GEMINI_API_KEY|GOOGLE_API_KEY)=.+' "$BACKEND/.env" \
    || die "后端需要 GEMINI_API_KEY 才能启动。请编辑 backend/.env 填入后重新运行 / the backend cannot start without GEMINI_API_KEY — set it in backend/.env and rerun"
fi

# ---------- 2. 前端准备 / Frontend setup ----------
say "准备前端 / Preparing frontend"
cd "$FRONTEND"
[[ -d node_modules ]] || npm install
# Optional: the pet falls back to the CDN when the local Live2D copy is missing, so a failure here is not fatal.
[[ -d public/live2d/Haru ]] || npm run live2d:download || warn "Live2D 资源下载失败,桌宠会改用在线资源 / Live2D download failed; the pet will use the CDN instead"

# ---------- 3. 启动 / Launch ----------
say "启动后端 / Starting backend (http://localhost:$BACKEND_PORT, log: backend/backend.log)"
( cd "$BACKEND" && exec "$PYTHON" -m uvicorn app.main:create_app --factory --reload --port "$BACKEND_PORT" ) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

cleanup() {
  trap - EXIT INT TERM
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    pkill -P "$BACKEND_PID" 2>/dev/null || true   # uvicorn --reload's worker
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Any HTTP response (even a 404) means the app booted. A bare TCP check is not enough: with --reload the
# parent process holds the port open even when the worker crashed on startup.
backend_up() { curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$BACKEND_PORT/"; }
for _ in $(seq 1 60); do
  kill -0 "$BACKEND_PID" 2>/dev/null || { tail -n 20 "$BACKEND_LOG" >&2; die "后端启动失败,见 backend/backend.log / backend failed to start, see backend/backend.log"; }
  backend_up && break
  sleep 0.5
done
backend_up || { tail -n 20 "$BACKEND_LOG" >&2; die "后端 30 秒内没有就绪,见 backend/backend.log / backend not ready after 30s, see backend/backend.log"; }

if [[ "$MODE" == web ]]; then
  say "启动前端 / Starting frontend — 浏览器打开 / open http://localhost:$FRONTEND_PORT  (Ctrl+C 退出 / to quit)"
  npm run dev -- --port "$FRONTEND_PORT" --strictPort
else
  say "启动桌面应用 / Starting desktop app  (Ctrl+C 退出 / to quit)"
  npm run desktop
fi
