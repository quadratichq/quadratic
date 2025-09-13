#!/bin/bash
# File: infra/k8s/scripts/tunnel.sh

set -e
set -u

# Config (override via flags or env)
NAMESPACE="${NAMESPACE:-quadratic-cloud}"
TUNNEL_NAME="${TUNNEL_NAME:-quadratic-localhost-tunnel}"
PORTS="${PORTS:-8000:8000,3001:3001,3002:3002,3003:3003}"  # comma-separated local:remote pairs

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}ℹ️  $*${NC}"; }
ok()  { echo -e "${GREEN}✅ $*${NC}"; }
warn(){ echo -e "${YELLOW}⚠️  $*${NC}"; }
err() { echo -e "${RED}❌ $*${NC}" >&2; }

usage() {
  cat <<EOF
Usage: $0 [install|start|stop|status|restart] [--namespace NS] [--name NAME] [--ports "8000:8000,3001:3001,..."]

Commands:
  install     Install ktunnel (macOS or Linux)
  start       Start tunnels (default ports: ${PORTS})
  stop        Stop tunnels and remove in-cluster tunnel resources
  status      Show tunnel process and in-cluster resources
  restart     Stop, then start

Options:
  --namespace NS  Kubernetes namespace (default: ${NAMESPACE})
  --name NAME     Tunnel service/deployment name (default: ${TUNNEL_NAME})
  --ports LIST    Comma-separated local:remote pairs (default: ${PORTS})

Env overrides: NAMESPACE, TUNNEL_NAME, PORTS
EOF
}

parse_args() {
  CMD="${1:-start}"; shift || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --namespace) NAMESPACE="$2"; shift 2 ;;
      --name)      TUNNEL_NAME="$2"; shift 2 ;;
      --ports)     PORTS="$2"; shift 2 ;;
      --help|-h)   usage; exit 0 ;;
      *)           err "Unknown arg: $1"; usage; exit 1 ;;
    esac
  done
}

ensure_kubectl() {
  if ! command -v kubectl >/dev/null 2>&1; then
    err "kubectl not found. Install kubectl first (mac: brew install kubectl; linux: see Kubernetes docs)."
    exit 1
  fi
}

ensure_ktunnel() {
  if command -v ktunnel >/dev/null 2>&1; then
    ok "ktunnel already installed"
    return
  fi

  OS="$(uname -s)"
  log "Installing ktunnel for ${OS}..."

  if [[ "$OS" == "Darwin" ]]; then
    if command -v brew >/dev/null 2>&1; then
      brew tap omrikiei/ktunnel
      brew install omrikiei/ktunnel/ktunnel
    else
      if command -v go >/dev/null 2>&1; then
        go install github.com/omrikiei/ktunnel@latest
        install -m 755 "$(go env GOPATH)/bin/ktunnel" /usr/local/bin/ktunnel
      else
        err "Homebrew or Go required to install ktunnel on macOS. Install brew (https://brew.sh) or Go, then re-run."
        exit 1
      fi
    fi
  elif [[ "$OS" == "Linux" ]]; then
    if ! command -v go >/dev/null 2>&1; then
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -y
        sudo apt-get install -y golang-go
      elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y golang
      elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y golang
      else
        err "Go not found and no supported package manager detected. Please install Go, then re-run."
        exit 1
      fi
    fi
    go install github.com/omrikiei/ktunnel@latest
    sudo install -m 755 "$(go env GOPATH)/bin/ktunnel" /usr/local/bin/ktunnel
  else
    err "Unsupported OS: $OS"
    exit 1
  fi

  if ! command -v ktunnel >/dev/null 2>&1; then
    err "ktunnel installation failed"
    exit 1
  fi
  ok "ktunnel installed: $(ktunnel -v 2>/dev/null || echo 'installed')"
}

ports_array() {
  IFS=',' read -r -a PORT_LIST <<< "$PORTS"
}

pid_file() {
  echo "/tmp/${TUNNEL_NAME}.pid"
}

log_file() {
  echo "/tmp/${TUNNEL_NAME}.log"
}

start_tunnel() {
  ensure_kubectl
  ensure_ktunnel

  # Validate namespace exists
  if ! kubectl get ns "$NAMESPACE" >/dev/null 2>&1; then
    err "Namespace '$NAMESPACE' not found. Deploy first or create it: kubectl create ns $NAMESPACE"
    exit 1
  fi

  ports_array
  if [[ ${#PORT_LIST[@]} -eq 0 ]]; then
    err "No ports specified"
    exit 1
  fi

  # Stop existing, if any
  stop_tunnel quiet || true

  log "Starting ktunnel expose to '$TUNNEL_NAME' in namespace '$NAMESPACE' for ports: ${PORTS}"
  nohup ktunnel -n "$NAMESPACE" expose "$TUNNEL_NAME" "${PORT_LIST[@]}" >"$(log_file)" 2>&1 &
  echo $! >"$(pid_file)"
  sleep 2

  # Wait for service/deployment to appear (best-effort)
  for i in {1..30}; do
    if kubectl -n "$NAMESPACE" get svc "$TUNNEL_NAME" >/dev/null 2>&1 && \
       kubectl -n "$NAMESPACE" get deploy "$TUNNEL_NAME" >/dev/null 2>&1; then
      ok "Tunnel resources created: service/deployment '$TUNNEL_NAME'"
      ok "PID $(cat "$(pid_file)") running; logs: $(log_file)"
      echo
      echo "Use in-cluster DNS:"
      echo "  http://${TUNNEL_NAME}.${NAMESPACE}.svc.cluster.local:<port>"
      return 0
    fi
    sleep 1
  done

  warn "Tunnel started, but resources not visible yet. Check: kubectl -n $NAMESPACE get svc,deploy $TUNNEL_NAME"
  ok "Logs: $(log_file)"
}

stop_tunnel() {
  MODE="${1:-normal}"
  local PIDF; PIDF="$(pid_file)"
  local LOGF; LOGF="$(log_file)"

  if [[ -f "$PIDF" ]]; then
    local PID; PID="$(cat "$PIDF" || true)"
    if [[ -n "${PID:-}" ]] && ps -p "$PID" >/dev/null 2>&1; then
      [[ "$MODE" != "quiet" ]] && log "Stopping ktunnel process PID $PID"
      kill "$PID" || true
      sleep 1
      if ps -p "$PID" >/dev/null 2>&1; then
        kill -9 "$PID" || true
      fi
    fi
    rm -f "$PIDF"
  fi

  # Remove in-cluster resources created by expose
  if kubectl -n "$NAMESPACE" get svc "$TUNNEL_NAME" >/dev/null 2>&1 || \
     kubectl -n "$NAMESPACE" get deploy "$TUNNEL_NAME" >/dev/null 2>&1; then
    [[ "$MODE" != "quiet" ]] && log "Deleting in-cluster tunnel resources: $TUNNEL_NAME"
    kubectl -n "$NAMESPACE" delete svc "$TUNNEL_NAME" --ignore-not-found=true
    kubectl -n "$NAMESPACE" delete deploy "$TUNNEL_NAME" --ignore-not-found=true
  fi

  [[ "$MODE" != "quiet" ]] && ok "Tunnel stopped and resources cleaned"
  [[ "$MODE" != "quiet" ]] && [[ -f "$LOGF" ]] && echo "Logs were at: $LOGF"
}

status_tunnel() {
  local PIDF; PIDF="$(pid_file)"
  echo -e "${BLUE}📋 Tunnel Status${NC}"
  echo "  Namespace: $NAMESPACE"
  echo "  Name:      $TUNNEL_NAME"
  echo "  Ports:     $PORTS"
  echo

  if [[ -f "$PIDF" ]]; then
    local PID; PID="$(cat "$PIDF" || true)"
    if [[ -n "${PID:-}" ]] && ps -p "$PID" >/dev/null 2>&1; then
      ok "Local process running (PID $PID)"
    else
      warn "PID file present but process not running"
    fi
  else
    warn "No PID file found; tunnel process may not be running"
  fi

  echo
  kubectl -n "$NAMESPACE" get svc "$TUNNEL_NAME" 2>/dev/null || true
  kubectl -n "$NAMESPACE" get deploy "$TUNNEL_NAME" 2>/dev/null || true
  kubectl -n "$NAMESPACE" get pods -l app="$TUNNEL_NAME" 2>/dev/null || true
}

restart_tunnel() {
  stop_tunnel quiet || true
  start_tunnel
}

main() {
  # Default to 'start' when no args
  if [[ $# -eq 0 ]]; then
    CMD="start"
  else
    parse_args "$@"
  fi

  case "$CMD" in
    install) ensure_ktunnel ;;
    start)   start_tunnel ;;
    stop)    stop_tunnel ;;
    status)  status_tunnel ;;
    restart) restart_tunnel ;;
    *)       err "Unknown command: $CMD"; usage; exit 1 ;;
  esac
}

main "$@"
