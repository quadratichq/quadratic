#!/bin/bash

#==============================================================================
# Quadratic Cloud - Port Forwarding Manager
#==============================================================================
# This script provides robust port forwarding management for Quadratic Cloud 
# services with background process management, status checking, and logging.
#
# Usage: ./infra/k8s/scripts/port-forward.sh [COMMAND] [OPTIONS]
# Commands: start, stop, restart, status, logs
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
NAMESPACE="${NAMESPACE:-quadratic-cloud}"
CONTEXT="${CONTEXT:-kind-quadratic-cloud}"
CMD="start"

# Port forwarding definitions
declare -A PORT_FORWARDS=(
    ["controller"]="3004:3004"
    ["metrics"]="9090:9090"
    ["redis"]="6380:6379"
)

declare -A SERVICE_NAMES=(
    ["controller"]="quadratic-cloud-controller"
    ["metrics"]="quadratic-cloud-controller"
    ["redis"]="quadratic-cloud-redis"
)

#------------------------------------------------------------------------------
# Colors
#------------------------------------------------------------------------------
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

#------------------------------------------------------------------------------
# Logging Functions
#------------------------------------------------------------------------------
log() { echo -e "${BLUE}ℹ️  $*${NC}"; }
ok()  { echo -e "${GREEN}✅ $*${NC}"; }
warn(){ echo -e "${YELLOW}⚠️  $*${NC}"; }
err() { echo -e "${RED}❌ $*${NC}" >&2; }

#------------------------------------------------------------------------------
# Help and Usage
#------------------------------------------------------------------------------
usage() {
    cat <<EOF
Usage: $0 [COMMAND] [OPTIONS]

Commands:
  start       Start port forwarding (default)
  stop        Stop all port forwarding
  restart     Stop and start port forwarding
  status      Show port forwarding status
  logs        Show port forwarding logs

Options:
  --namespace NS    Kubernetes namespace (default: ${NAMESPACE})
  --context CTX     Kubectl context (default: ${CONTEXT})
  --help            Show this help

Services forwarded:
  • Controller API:     http://localhost:3004
  • Controller Metrics: http://localhost:9090
  • Redis:              localhost:6380

Env overrides: NAMESPACE
EOF
}

#------------------------------------------------------------------------------
# Argument Parsing
#------------------------------------------------------------------------------
parse_args() {
    if [[ $# -gt 0 ]] && [[ "$1" =~ ^(start|stop|restart|status|logs)$ ]]; then
        CMD="$1"
        shift
    fi
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --namespace) NAMESPACE="$2"; shift 2 ;;
            --context)   CONTEXT="$2"; shift 2 ;;
            --help|-h)   usage; exit 0 ;;
            *)           err "Unknown arg: $1"; usage; exit 1 ;;
        esac
    done
}

#------------------------------------------------------------------------------
# File Management
#------------------------------------------------------------------------------
get_pid_file() {
    local service="$1"
    echo "/tmp/quadratic-port-forward-${service}.pid"
}

get_log_file() {
    local service="$1"
    echo "/tmp/quadratic-port-forward-${service}.log"
}

#------------------------------------------------------------------------------
# Environment Validation
#------------------------------------------------------------------------------
ensure_kubectl() {
    if ! command -v kubectl >/dev/null 2>&1; then
        err "kubectl not found"
        exit 1
    fi
}

validate_environment() {
    ensure_kubectl
    
    if ! kubectl cluster-info --context "$CONTEXT" >/dev/null 2>&1; then
        err "Cannot connect to cluster context: $CONTEXT"
        exit 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" --context "$CONTEXT" >/dev/null 2>&1; then
        err "Namespace '$NAMESPACE' not found"
        exit 1
    fi
}

#------------------------------------------------------------------------------
# Port Forward Management
#------------------------------------------------------------------------------
start_port_forward() {
    local service="$1"
    local port_mapping="${PORT_FORWARDS[$service]}"
    local service_name="${SERVICE_NAMES[$service]}"
    local pid_file; pid_file="$(get_pid_file "$service")"
    local log_file; log_file="$(get_log_file "$service")"
    
    # Stop existing if running
    stop_port_forward_service "$service" quiet || true
    
    log "Starting port forward for $service ($port_mapping)"
    
    # Start port forward in background
    nohup kubectl port-forward "svc/$service_name" "$port_mapping" \
        -n "$NAMESPACE" --context "$CONTEXT" \
        >"$log_file" 2>&1 &
    
    local pid=$!
    echo "$pid" > "$pid_file"
    
    # Wait a moment and check if it's still running
    sleep 2
    if ps -p "$pid" >/dev/null 2>&1; then
        ok "Port forward for $service started (PID: $pid)"
        return 0
    else
        err "Port forward for $service failed to start"
        cat "$log_file" || true
        return 1
    fi
}

stop_port_forward_service() {
    local service="$1"
    local mode="${2:-normal}"
    local pid_file; pid_file="$(get_pid_file "$service")"
    local log_file; log_file="$(get_log_file "$service")"
    
    if [[ -f "$pid_file" ]]; then
        local pid; pid="$(cat "$pid_file" || true)"
        if [[ -n "${pid:-}" ]] && ps -p "$pid" >/dev/null 2>&1; then
            [[ "$mode" != "quiet" ]] && log "Stopping port forward for $service (PID: $pid)"
            kill "$pid" || true
            sleep 1
            if ps -p "$pid" >/dev/null 2>&1; then
                kill -9 "$pid" || true
            fi
            [[ "$mode" != "quiet" ]] && ok "Port forward for $service stopped"
        fi
        rm -f "$pid_file"
    fi
    
    # Clean up log file if requested
    if [[ "$mode" == "clean" ]]; then
        rm -f "$log_file"
    fi
}

start_all_port_forwards() {
    validate_environment
    
    log "Starting all port forwards..."
    local failed=0
    
    for service in "${!PORT_FORWARDS[@]}"; do
        if ! start_port_forward "$service"; then
            ((failed++))
        fi
    done
    
    if [[ $failed -eq 0 ]]; then
        ok "All port forwards started successfully"
        echo
        show_access_info
    else
        err "$failed port forward(s) failed to start"
        return 1
    fi
}

stop_all_port_forwards() {
    log "Stopping all port forwards..."
    
    for service in "${!PORT_FORWARDS[@]}"; do
        stop_port_forward_service "$service"
    done
    
    ok "All port forwards stopped"
}

restart_all_port_forwards() {
    stop_all_port_forwards
    sleep 2
    start_all_port_forwards
}

#------------------------------------------------------------------------------
# Status and Information
#------------------------------------------------------------------------------
show_port_forward_status() {
    echo -e "${PURPLE}🔗 Port Forward Status${NC}"
    echo "  Namespace: $NAMESPACE"
    echo "  Context:   $CONTEXT"
    echo
    
    local any_running=false
    
    for service in "${!PORT_FORWARDS[@]}"; do
        local pid_file; pid_file="$(get_pid_file "$service")"
        local port_mapping="${PORT_FORWARDS[$service]}"
        local local_port; local_port="${port_mapping%%:*}"
        
        echo -n "  $service ($port_mapping): "
        
        if [[ -f "$pid_file" ]]; then
            local pid; pid="$(cat "$pid_file" || true)"
            if [[ -n "${pid:-}" ]] && ps -p "$pid" >/dev/null 2>&1; then
                echo -e "${GREEN}Running (PID: $pid)${NC}"
                any_running=true
                
                # Test local port connectivity
                if command -v nc >/dev/null 2>&1; then
                    if nc -z localhost "$local_port" 2>/dev/null; then
                        echo "    ↳ localhost:$local_port responding"
                    else
                        echo -e "    ↳ ${YELLOW}localhost:$local_port not responding${NC}"
                    fi
                fi
            else
                echo -e "${RED}Not running (stale PID)${NC}"
            fi
        else
            echo -e "${RED}Not running${NC}"
        fi
    done
    
    if [[ "$any_running" == true ]]; then
        echo
        show_access_info
    fi
}

show_port_forward_logs() {
    echo -e "${PURPLE}📋 Port Forward Logs${NC}"
    echo
    
    for service in "${!PORT_FORWARDS[@]}"; do
        local log_file; log_file="$(get_log_file "$service")"
        
        echo -e "${CYAN}--- $service logs ---${NC}"
        if [[ -f "$log_file" ]]; then
            tail -20 "$log_file" 2>/dev/null || echo "No logs available"
        else
            echo "No log file found"
        fi
        echo
    done
}

show_access_info() {
    echo -e "${CYAN}📋 Access Information:${NC}"
    echo "  • Controller API:     http://localhost:3004"
    echo "  • Controller Health:  http://localhost:3004/health"
    echo "  • Controller JWKS:    http://localhost:3004/.well-known/jwks.json"
    echo "  • Controller Metrics: http://localhost:9090/metrics"
    echo "  • Redis CLI:          redis-cli -h localhost -p 6380"
    echo
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    # Default to 'start' when no args
    if [[ $# -eq 0 ]]; then
        CMD="start"
    else
        parse_args "$@"
    fi
    
    case "$CMD" in
        start)   start_all_port_forwards ;;
        stop)    stop_all_port_forwards ;;
        restart) restart_all_port_forwards ;;
        status)  show_port_forward_status ;;
        logs)    show_port_forward_logs ;;
        *)       err "Unknown command: $CMD"; usage; exit 1 ;;
    esac
}

main "$@"
