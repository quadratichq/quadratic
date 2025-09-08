#!/bin/bash

#==============================================================================
# Quadratic Cloud - Log Viewer Script
#==============================================================================
# This script provides convenient access to logs from all Quadratic Cloud
# components with filtering, following, and aggregation options.
#
# Usage: ./k8s/scripts/logs.sh [COMPONENT] [OPTIONS]
# Components: controller, redis, worker, all
# Options:
#   -f, --follow        Follow log output
#   -t, --tail N        Show last N lines (default: 100)
#   --since DURATION    Show logs since duration (e.g., 1h, 30m)
#   --level LEVEL       Filter by log level (info, warn, error, debug)
#   --namespace NS      Custom namespace (default: quadratic-cloud)
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="quadratic-cloud"
CONTEXT="kind-quadratic-cloud"
COMPONENT="all"
FOLLOW=false
TAIL_LINES=100
SINCE=""
LOG_LEVEL=""

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
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

#------------------------------------------------------------------------------
# Help Function
#------------------------------------------------------------------------------
show_help() {
    cat << EOF
Quadratic Cloud - Log Viewer

USAGE:
    $0 [COMPONENT] [OPTIONS]

COMPONENTS:
    controller    Show controller logs only
    redis         Show Redis logs only
    worker        Show worker logs only
    all           Show all component logs (default)

OPTIONS:
    -f, --follow        Follow log output (like tail -f)
    -t, --tail N        Show last N lines (default: 100)
    --since DURATION    Show logs since duration (e.g., 1h, 30m, 2023-01-01T10:00:00Z)
    --level LEVEL       Filter by log level (info, warn, error, debug)
    --namespace NS      Custom namespace (default: quadratic-cloud)
    --context CTX       Custom kubectl context
    --help              Show this help

EXAMPLES:
    $0                           # Show last 100 lines from all components
    $0 controller -f             # Follow controller logs
    $0 redis --tail 50           # Show last 50 lines from Redis
    $0 all --since 1h            # Show logs from last hour
    $0 controller --level error  # Show only error logs from controller

EOF
}

#------------------------------------------------------------------------------
# Parse Arguments
#------------------------------------------------------------------------------
parse_args() {
    # First argument might be component
    if [ $# -gt 0 ] && [[ "$1" =~ ^(controller|redis|worker|all)$ ]]; then
        COMPONENT="$1"
        shift
    fi
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--follow)
                FOLLOW=true
                shift
                ;;
            -t|--tail)
                TAIL_LINES="$2"
                shift 2
                ;;
            --since)
                SINCE="$2"
                shift 2
                ;;
            --level)
                LOG_LEVEL="$2"
                shift 2
                ;;
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --context)
                CONTEXT="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

#------------------------------------------------------------------------------
# Log Functions
#------------------------------------------------------------------------------
run_kubectl() {
    kubectl --context "$CONTEXT" --namespace "$NAMESPACE" "$@"
}

get_logs() {
    local selector="$1"
    local component_name="$2"
    
    # Build kubectl logs command
    local cmd_args=("logs" "-l" "$selector")
    
    if [ "$FOLLOW" = true ]; then
        cmd_args+=("-f")
    fi
    
    if [ -n "$TAIL_LINES" ]; then
        cmd_args+=("--tail=$TAIL_LINES")
    fi
    
    if [ -n "$SINCE" ]; then
        cmd_args+=("--since=$SINCE")
    fi
    
    # Add prefix for multi-component viewing
    if [ "$COMPONENT" = "all" ]; then
        cmd_args+=("--prefix=true")
    fi
    
    # Execute kubectl logs
    log_info "📋 Showing logs for: $component_name"
    if [ -n "$LOG_LEVEL" ]; then
        log_info "🔍 Filtering for level: $LOG_LEVEL"
        run_kubectl "${cmd_args[@]}" | grep -i "$LOG_LEVEL" || {
            log_info "No logs found with level: $LOG_LEVEL"
        }
    else
        run_kubectl "${cmd_args[@]}"
    fi
}

show_controller_logs() {
    get_logs "app.kubernetes.io/name=quadratic-cloud-controller" "Controller"
}

show_redis_logs() {
    get_logs "app.kubernetes.io/name=quadratic-cloud-redis" "Redis"
}

show_worker_logs() {
    get_logs "app.kubernetes.io/component=worker" "Workers"
}

show_all_logs() {
    if [ "$FOLLOW" = true ]; then
        # For follow mode, show all components in parallel
        log_info "📋 Following logs from all components..."
        run_kubectl logs -l "app.kubernetes.io/part-of=quadratic-cloud" \
            -f --prefix=true --tail="$TAIL_LINES" \
            ${SINCE:+--since="$SINCE"} \
            | if [ -n "$LOG_LEVEL" ]; then grep -i "$LOG_LEVEL"; else cat; fi
    else
        # For non-follow mode, show each component separately
        echo -e "${PURPLE}🔧 Redis Logs:${NC}"
        echo "=================================="
        show_redis_logs
        echo
        
        echo -e "${PURPLE}🔧 Controller Logs:${NC}"
        echo "=================================="
        show_controller_logs
        echo
        
        echo -e "${PURPLE}🔧 Worker Logs:${NC}"
        echo "=================================="
        show_worker_logs || log_info "No worker pods found"
    fi
}

#------------------------------------------------------------------------------
# Status Functions
#------------------------------------------------------------------------------
show_pod_status() {
    log_info "📊 Pod Status:"
    run_kubectl get pods -o wide || {
        log_error "Failed to get pod status"
        return 1
    }
    echo
}

show_recent_events() {
    log_info "📅 Recent Events:"
    run_kubectl get events --sort-by='.lastTimestamp' | tail -10 || {
        log_error "Failed to get events"
        return 1
    }
    echo
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    echo -e "${BLUE}📋 Quadratic Cloud Log Viewer${NC}"
    echo
    
    # Parse arguments
    parse_args "$@"
    
    # Validate environment
    if ! kubectl cluster-info --context "$CONTEXT" &> /dev/null; then
        log_error "Cannot connect to cluster context: $CONTEXT"
        exit 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" --context "$CONTEXT" &> /dev/null; then
        log_error "Namespace not found: $NAMESPACE"
        exit 1
    fi
    
    # Show status first (unless following logs)
    if [ "$FOLLOW" = false ]; then
        show_pod_status
        show_recent_events
    fi
    
    # Show logs based on component
    case "$COMPONENT" in
        "controller")
            show_controller_logs
            ;;
        "redis")
            show_redis_logs
            ;;
        "worker")
            show_worker_logs
            ;;
        "all")
            show_all_logs
            ;;
        *)
            log_error "Unknown component: $COMPONENT"
            show_help
            exit 1
            ;;
    esac
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}⚠️  Log viewing stopped${NC}"; exit 0' INT

# Run main function
main "$@"
