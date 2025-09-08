#!/bin/bash

#==============================================================================
# Quadratic Cloud - Status Checker
#==============================================================================
# This script provides a comprehensive overview of the Quadratic Cloud
# system status, including all components, resources, and health metrics.
#
# Usage: ./k8s/scripts/status.sh [OPTIONS]
# Options:
#   --watch       Continuously monitor status (refresh every 5 seconds)
#   --detailed    Show detailed resource information
#   --json        Output in JSON format
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
NAMESPACE="quadratic-cloud"
CONTEXT="kind-quadratic-cloud"
WATCH_MODE=false
DETAILED_MODE=false
JSON_OUTPUT=false
REFRESH_INTERVAL=5

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
# Parse Arguments
#------------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --watch)
                WATCH_MODE=true
                shift
                ;;
            --detailed)
                DETAILED_MODE=true
                shift
                ;;
            --json)
                JSON_OUTPUT=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
Quadratic Cloud - Status Checker

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --watch       Continuously monitor status (refresh every 5s)
    --detailed    Show detailed resource information
    --json        Output in JSON format
    --help        Show this help

EXAMPLES:
    $0                # Show current status
    $0 --watch        # Monitor status continuously
    $0 --detailed     # Show detailed information

EOF
}

#------------------------------------------------------------------------------
# Status Functions
#------------------------------------------------------------------------------
run_kubectl() {
    kubectl --context "$CONTEXT" --namespace "$NAMESPACE" "$@"
}

show_header() {
    if [ "$JSON_OUTPUT" = true ]; then
        return 0
    fi
    
    clear
    echo -e "${BLUE}📊 Quadratic Cloud System Status${NC}"
    echo -e "${CYAN}Namespace: $NAMESPACE | Context: $CONTEXT${NC}"
    echo -e "${CYAN}Time: $(date)${NC}"
    echo "=================================================================="
    echo
}

show_pods_status() {
    if [ "$JSON_OUTPUT" = true ]; then
        run_kubectl get pods -o json | jq '.items[] | {name: .metadata.name, status: .status.phase, ready: (.status.conditions[] | select(.type=="Ready") | .status)}'
        return 0
    fi
    
    echo -e "${PURPLE}🏃 Pod Status:${NC}"
    run_kubectl get pods -o wide
    echo
}

show_services_status() {
    if [ "$JSON_OUTPUT" = true ]; then
        run_kubectl get services -o json
        return 0
    fi
    
    echo -e "${PURPLE}🌐 Services:${NC}"
    run_kubectl get services
    echo
}

show_deployments_status() {
    if [ "$JSON_OUTPUT" = true ]; then
        run_kubectl get deployments -o json
        return 0
    fi
    
    echo -e "${PURPLE}📦 Deployments:${NC}"
    run_kubectl get deployments
    echo
}

show_statefulsets_status() {
    if [ "$JSON_OUTPUT" = true ]; then
        run_kubectl get statefulsets -o json
        return 0
    fi
    
    echo -e "${PURPLE}📋 StatefulSets:${NC}"
    run_kubectl get statefulsets
    echo
}

show_persistent_volumes() {
    if [ "$JSON_OUTPUT" = true ]; then
        run_kubectl get pvc -o json
        return 0
    fi
    
    echo -e "${PURPLE}💾 Persistent Volumes:${NC}"
    run_kubectl get pvc
    echo
}

show_recent_events() {
    if [ "$JSON_OUTPUT" = true ]; then
        run_kubectl get events -o json | jq '.items | sort_by(.lastTimestamp) | reverse | .[0:10]'
        return 0
    fi
    
    echo -e "${PURPLE}📅 Recent Events (last 10):${NC}"
    run_kubectl get events --sort-by='.lastTimestamp' | tail -10
    echo
}

show_resource_usage() {
    if [ "$JSON_OUTPUT" = true ]; then
        # Try to get metrics, fall back to limits if not available
        run_kubectl top pods --no-headers 2>/dev/null | awk '{print "{\"pod\":\""$1"\",\"cpu\":\""$2"\",\"memory\":\""$3"\"}"}' || echo '{"error": "metrics not available"}'
        return 0
    fi
    
    echo -e "${PURPLE}📈 Resource Usage:${NC}"
    if run_kubectl top pods 2>/dev/null; then
        echo
    else
        echo "  (Metrics server not available)"
        echo
        echo -e "${PURPLE}📊 Resource Limits:${NC}"
        run_kubectl get pods -o custom-columns="NAME:.metadata.name,CPU-REQUEST:.spec.containers[*].resources.requests.cpu,MEMORY-REQUEST:.spec.containers[*].resources.requests.memory,CPU-LIMIT:.spec.containers[*].resources.limits.cpu,MEMORY-LIMIT:.spec.containers[*].resources.limits.memory"
        echo
    fi
}

show_health_status() {
    if [ "$JSON_OUTPUT" = true ]; then
        # Create JSON health summary
        local controller_health="unknown"
        local redis_health="unknown"
        
        if run_kubectl exec deployment/quadratic-cloud-controller -- curl -s -f http://localhost:3004/health 2>/dev/null; then
            controller_health="healthy"
        else
            controller_health="unhealthy"
        fi
        
        if run_kubectl exec statefulset/quadratic-cloud-redis -- redis-cli ping 2>/dev/null | grep -q PONG; then
            redis_health="healthy"
        else
            redis_health="unhealthy"
        fi
        
        echo "{\"controller\": \"$controller_health\", \"redis\": \"$redis_health\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
        return 0
    fi
    
    echo -e "${PURPLE}🏥 Health Status:${NC}"
    
    # Check Controller health
    echo -n "  Controller: "
    if run_kubectl exec deployment/quadratic-cloud-controller -- curl -s -f http://localhost:3004/health &>/dev/null; then
        echo -e "${GREEN}Healthy${NC}"
    else
        echo -e "${RED}Unhealthy${NC}"
    fi
    
    # Check Redis health
    echo -n "  Redis: "
    if run_kubectl exec statefulset/quadratic-cloud-redis -- redis-cli ping 2>/dev/null | grep -q PONG; then
        echo -e "${GREEN}Healthy${NC}"
    else
        echo -e "${RED}Unhealthy${NC}"
    fi
    echo
}

show_worker_jobs() {
    if [ "$JSON_OUTPUT" = true ]; then
        run_kubectl get jobs -l app.kubernetes.io/component=worker -o json 2>/dev/null || echo '{"items": []}'
        return 0
    fi
    
    echo -e "${PURPLE}⚙️  Worker Jobs:${NC}"
    if run_kubectl get jobs -l app.kubernetes.io/component=worker --no-headers 2>/dev/null | wc -l | grep -q "^0$"; then
        echo "  No active worker jobs"
    else
        run_kubectl get jobs -l app.kubernetes.io/component=worker
    fi
    echo
}

show_detailed_status() {
    if [ "$DETAILED_MODE" = false ]; then
        return 0
    fi
    
    if [ "$JSON_OUTPUT" = true ]; then
        return 0
    fi
    
    echo -e "${PURPLE}🔍 Detailed Information:${NC}"
    
    echo "Controller Pod Details:"
    run_kubectl describe pod -l app.kubernetes.io/name=quadratic-cloud-controller | head -30
    echo
    
    echo "Redis Pod Details:"
    run_kubectl describe pod -l app.kubernetes.io/name=quadratic-cloud-redis | head -30
    echo
}

show_summary() {
    if [ "$JSON_OUTPUT" = true ]; then
        # Create comprehensive JSON summary
        cat << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "namespace": "$NAMESPACE",
  "context": "$CONTEXT"
}
EOF
        return 0
    fi
    
    echo -e "${PURPLE}📋 System Summary:${NC}"
    
    local total_pods running_pods
    total_pods=$(run_kubectl get pods --no-headers | wc -l)
    running_pods=$(run_kubectl get pods --no-headers | grep Running | wc -l)
    
    echo "  • Total Pods: $total_pods"
    echo "  • Running Pods: $running_pods"
    
    local services
    services=$(run_kubectl get services --no-headers | wc -l)
    echo "  • Services: $services"
    
    local pvcs
    pvcs=$(run_kubectl get pvc --no-headers 2>/dev/null | wc -l || echo "0")
    echo "  • Persistent Volumes: $pvcs"
    
    local jobs
    jobs=$(run_kubectl get jobs --no-headers 2>/dev/null | wc -l || echo "0")
    echo "  • Jobs: $jobs"
    
    echo
}

show_access_info() {
    if [ "$JSON_OUTPUT" = true ]; then
        return 0
    fi
    
    echo -e "${PURPLE}🔗 Quick Access Commands:${NC}"
    echo "  • Controller API:"
    echo "    kubectl port-forward svc/quadratic-cloud-controller 3004:3004 -n $NAMESPACE"
    echo "  • Redis CLI:"
    echo "    kubectl exec -it statefulset/quadratic-cloud-redis -n $NAMESPACE -- redis-cli"
    echo "  • Controller Logs:"
    echo "    kubectl logs -f deployment/quadratic-cloud-controller -n $NAMESPACE"
    echo "  • All Logs:"
    echo "    ./k8s/scripts/logs.sh"
    echo
}

#------------------------------------------------------------------------------
# Main Status Display
#------------------------------------------------------------------------------
display_status() {
    show_header
    show_pods_status
    show_services_status
    show_deployments_status
    show_statefulsets_status
    show_persistent_volumes
    show_health_status
    show_worker_jobs
    show_resource_usage
    show_recent_events
    show_detailed_status
    show_summary
    show_access_info
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
    
    if ! kubectl get namespace "$NAMESPACE" --context "$CONTEXT" &>/dev/null; then
        echo "Error: Namespace not found: $NAMESPACE" >&2
        exit 1
    fi
    
    if [ "$WATCH_MODE" = true ]; then
        # Continuous monitoring mode
        trap 'echo -e "\n${YELLOW}⚠️  Monitoring stopped${NC}"; exit 0' INT
        
        while true; do
            display_status
            if [ "$JSON_OUTPUT" = false ]; then
                echo -e "${CYAN}Refreshing in ${REFRESH_INTERVAL}s... (Ctrl+C to stop)${NC}"
            fi
            sleep $REFRESH_INTERVAL
        done
    else
        # Single status check
        display_status
    fi
}

# Run main function
main "$@"