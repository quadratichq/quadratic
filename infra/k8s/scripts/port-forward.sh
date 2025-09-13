#!/bin/bash

#==============================================================================
# Quadratic Cloud - Port Forwarding Helper
#==============================================================================
# This script provides easy port forwarding to Quadratic Cloud services
# for local development and testing.
#
# Usage: ./infra/k8s/scripts/port-forward.sh [SERVICE] [OPTIONS]
# Services: controller, redis, metrics, all
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
NAMESPACE="quadratic-cloud"
CONTEXT="kind-quadratic-cloud"
SERVICE="controller"

#------------------------------------------------------------------------------
# Colors
#------------------------------------------------------------------------------
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

#------------------------------------------------------------------------------
# Parse Arguments
#------------------------------------------------------------------------------
parse_args() {
    if [ $# -gt 0 ] && [[ "$1" =~ ^(controller|redis|metrics|all)$ ]]; then
        SERVICE="$1"
        shift
    fi
}

show_help() {
    cat << EOF
Quadratic Cloud - Port Forwarding Helper

USAGE:
    $0 [SERVICE]

SERVICES:
    controller    Forward controller API (default)
    redis         Forward Redis port
    metrics       Forward metrics port
    all           Forward all services (in background)

EXAMPLES:
    $0                # Forward controller to localhost:3004
    $0 redis          # Forward Redis to localhost:6379
    $0 all            # Forward all services

ACCESS URLS:
    Controller API:    http://localhost:3004
    Controller Health: http://localhost:3004/health
    Metrics:          http://localhost:9090
    Redis:            localhost:6379

EOF
}

#------------------------------------------------------------------------------
# Port Forward Functions
#------------------------------------------------------------------------------
forward_controller() {
    echo -e "${BLUE}🔗 Forwarding Controller API to localhost:3004${NC}"
    echo -e "${GREEN}Access at: http://localhost:3004${NC}"
    echo -e "${GREEN}Health check: http://localhost:3004/health${NC}"
    echo
    kubectl port-forward svc/quadratic-cloud-controller 3004:3004 -n "$NAMESPACE" --context "$CONTEXT"
}

forward_redis() {
    echo -e "${BLUE}🔗 Forwarding Redis to localhost:6379${NC}"
    echo -e "${GREEN}Connect with: redis-cli -h localhost -p 6379${NC}"
    echo
    kubectl port-forward svc/quadratic-cloud-redis 6379:6379 -n "$NAMESPACE" --context "$CONTEXT"
}

forward_metrics() {
    echo -e "${BLUE}🔗 Forwarding Metrics to localhost:9090${NC}"
    echo -e "${GREEN}Access at: http://localhost:9090/metrics${NC}"
    echo
    kubectl port-forward svc/quadratic-cloud-controller 9090:9090 -n "$NAMESPACE" --context "$CONTEXT"
}

forward_all() {
    echo -e "${BLUE}🔗 Starting all port forwards in background...${NC}"
    echo
    
    # Start port forwards in background
    kubectl port-forward svc/quadratic-cloud-controller 3004:3004 -n "$NAMESPACE" --context "$CONTEXT" &
    CONTROLLER_PID=$!
    
    kubectl port-forward svc/quadratic-cloud-controller 9090:9090 -n "$NAMESPACE" --context "$CONTEXT" &
    METRICS_PID=$!
    
    kubectl port-forward svc/quadratic-cloud-redis 6379:6379 -n "$NAMESPACE" --context "$CONTEXT" &
    REDIS_PID=$!
    
    # Display access information
    echo -e "${GREEN}🎉 All services forwarded:${NC}"
    echo "  • Controller API:    http://localhost:3004"
    echo "  • Controller Health: http://localhost:3004/health"
    echo "  • Metrics:          http://localhost:9090/metrics"
    echo "  • Redis:            localhost:6379"
    echo
    echo -e "${YELLOW}⚠️  Press Ctrl+C to stop all port forwards${NC}"
    
    # Wait for interrupt
    trap 'echo -e "\n${YELLOW}Stopping all port forwards...${NC}"; kill $CONTROLLER_PID $METRICS_PID $REDIS_PID 2>/dev/null; exit 0' INT
    wait
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    parse_args "$@"
    
    # Validate environment
    if ! kubectl cluster-info --context "$CONTEXT" &>/dev/null; then
        echo "Error: Cannot connect to cluster context: $CONTEXT" >&2
        exit 1
    fi
    
    case "$SERVICE" in
        "controller")
            forward_controller
            ;;
        "redis")
            forward_redis
            ;;
        "metrics")
            forward_metrics
            ;;
        "all")
            forward_all
            ;;
        *)
            echo "Unknown service: $SERVICE"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
