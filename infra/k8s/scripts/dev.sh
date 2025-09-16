#!/bin/bash

#==============================================================================
# Quadratic Cloud - Development Helper
#==============================================================================
# This script provides common development workflows for rapid iteration.
#
# Usage: ./infra/k8s/scripts/dev.sh [COMMAND] [OPTIONS]
# Commands: rebuild, restart, reset, shell
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="quadratic-cloud"
CONTEXT="kind-quadratic-cloud"
COMMAND="rebuild"

#------------------------------------------------------------------------------
# Colors
#------------------------------------------------------------------------------
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly PURPLE='\033[0;35m'
readonly NC='\033[0m'

#------------------------------------------------------------------------------
# Parse Arguments
#------------------------------------------------------------------------------
parse_args() {
    if [ $# -gt 0 ]; then
        COMMAND="$1"
        shift
    fi
}

show_help() {
    cat << EOF
Quadratic Cloud - Development Helper

USAGE:
    $0 [COMMAND]

COMMANDS:
    rebuild     Rebuild images and redeploy (default)
    restart     Restart pods without rebuilding
    reset       Complete reset (cluster + images)
    shell       Open shell in controller pod

EXAMPLES:
    $0               # Rebuild and redeploy
    $0 restart       # Just restart pods
    $0 shell         # Open shell in controller

EOF
}

#------------------------------------------------------------------------------
# Development Commands
#------------------------------------------------------------------------------
dev_rebuild() {
    echo -e "${BLUE}🔄 Rebuilding and redeploying...${NC}"
    
    "${SCRIPT_DIR}/build.sh"
    "${SCRIPT_DIR}/deploy.sh"
    "${SCRIPT_DIR}/tunnel.sh"
    "${SCRIPT_DIR}/port-forward.sh"
    
    echo -e "${GREEN}✅ Rebuild complete!${NC}"
}

dev_restart() {
    echo -e "${BLUE}🔄 Restarting pods...${NC}"
    
    kubectl rollout restart deployment/quadratic-cloud-controller -n "$NAMESPACE" --context "$CONTEXT"
    kubectl rollout restart statefulset/quadratic-cloud-redis -n "$NAMESPACE" --context "$CONTEXT"
    
    echo -e "${YELLOW}⏳ Waiting for rollout...${NC}"
    kubectl rollout status deployment/quadratic-cloud-controller -n "$NAMESPACE" --context "$CONTEXT"
    kubectl rollout status statefulset/quadratic-cloud-redis -n "$NAMESPACE" --context "$CONTEXT"
    
    echo -e "${GREEN}✅ Restart complete!${NC}"
}

dev_reset() {
    echo -e "${BLUE}🔄 Complete reset...${NC}"
    
    "${SCRIPT_DIR}/cleanup.sh" all --force
    "${SCRIPT_DIR}/setup.sh"
    "${SCRIPT_DIR}/build.sh"
    "${SCRIPT_DIR}/deploy.sh"
    "${SCRIPT_DIR}/tunnel.sh"
    "${SCRIPT_DIR}/port-forward.sh"
    
    echo -e "${GREEN}✅ Reset complete!${NC}"
}

dev_shell() {
    echo -e "${BLUE}🐚 Opening shell in controller pod...${NC}"
    
    kubectl exec -it deployment/quadratic-cloud-controller -n "$NAMESPACE" --context "$CONTEXT" -- /bin/sh
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    parse_args "$@"
    
    case "$COMMAND" in
        "rebuild")
            dev_rebuild
            ;;
        "restart")
            dev_restart
            ;;
        "reset")
            dev_reset
            ;;
        "shell")
            dev_shell
            ;;
        *)
            echo "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
