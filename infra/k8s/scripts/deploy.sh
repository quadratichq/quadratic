#!/bin/bash

#==============================================================================
# Quadratic Cloud - Kubernetes Deployment Script
#==============================================================================
# This script deploys the complete Quadratic Cloud system to Kubernetes
# in the correct order with proper dependency handling and verification.
#
# What it does:
# - Validates the deployment environment
# - Deploys manifests in dependency order
# - Waits for services to become ready
# - Performs health checks and verification
# - Provides access information and next steps
#
# Usage: ./infra/k8s/scripts/deploy.sh [OPTIONS]
# Options:
#   --force         Force redeploy (delete and recreate resources)
#   --wait          Wait for all resources to be ready (default)
#   --no-wait       Don't wait for resources to be ready
#   --timeout SEC   Custom timeout in seconds (default: 300)
#   --namespace NS  Custom namespace (default: quadratic-cloud)
#==============================================================================

set -e  # Exit on any error
set -u  # Exit on undefined variables

#------------------------------------------------------------------------------
# Configuration Constants
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Default configuration
NAMESPACE="quadratic-cloud"
CLUSTER_NAME="quadratic-cloud"
CONTEXT="kind-${CLUSTER_NAME}"
FORCE_DEPLOY=false
WAIT_FOR_READY=true
TIMEOUT=300

# Manifest files in deployment order (dependencies first)
readonly MANIFESTS=(
    "01-namespace.yaml"
    "02-redis.yaml"
    "03-rbac.yaml"
    "04-controller.yaml"
    "05-monitoring.yaml"
)

#------------------------------------------------------------------------------
# Color Constants
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

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔧 $1${NC}"
}

log_deploy() {
    echo -e "${CYAN}🚀 $1${NC}"
}

#------------------------------------------------------------------------------
# Help Function
#------------------------------------------------------------------------------
show_help() {
    cat << EOF
Quadratic Cloud - Kubernetes Deployment Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --force           Force redeploy (delete and recreate resources)
    --wait            Wait for all resources to be ready (default)
    --no-wait         Don't wait for resources to be ready
    --timeout SEC     Custom timeout in seconds (default: 300)
    --namespace NS    Custom namespace (default: quadratic-cloud)
    --context CTX     Custom kubectl context (default: kind-quadratic-cloud)
    --help            Show this help message

EXAMPLES:
    $0                    # Standard deployment
    $0 --force            # Force redeploy everything
    $0 --no-wait          # Deploy without waiting
    $0 --timeout 600      # Deploy with 10-minute timeout

DEPLOYMENT ORDER:
    1. Namespace and network policies
    2. Redis database with persistence
    3. RBAC (roles and service accounts)
    4. Controller application
    5. Monitoring resources

EOF
}

#------------------------------------------------------------------------------
# Parse Command Line Arguments
#------------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --wait)
                WAIT_FOR_READY=true
                shift
                ;;
            --no-wait)
                WAIT_FOR_READY=false
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
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
# Environment Validation Functions
#------------------------------------------------------------------------------
check_deployment_environment() {
    log_step "Checking deployment environment..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        log_info "Install kubectl: https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info --context "$CONTEXT" &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        log_info "Available contexts:"
        kubectl config get-contexts
        log_info "Use: kubectl config use-context $CONTEXT"
        exit 1
    fi
    
    # Check if cluster nodes are ready
    if ! kubectl get nodes --context "$CONTEXT" &> /dev/null; then
        log_error "Cannot access cluster nodes"
        exit 1
    fi
    
    # Check manifest files
    for manifest in "${MANIFESTS[@]}"; do
        local manifest_path="infra/k8s/manifests/${manifest}"
        if [ ! -f "$manifest_path" ]; then
            log_error "Manifest not found: $manifest_path"
            exit 1
        fi
    done
    
    log_success "Deployment environment is ready"
    log_info "Target cluster: $CONTEXT"
    log_info "Target namespace: $NAMESPACE"
}

#------------------------------------------------------------------------------
# Deployment Functions
#------------------------------------------------------------------------------
force_cleanup_namespace() {
    if [ "$FORCE_DEPLOY" = true ]; then
        log_warning "Force cleanup: removing existing namespace $NAMESPACE"
        kubectl delete namespace "$NAMESPACE" --context "$CONTEXT" --ignore-not-found=true
        
        # Wait for namespace to be fully deleted
        log_info "Waiting for namespace cleanup..."
        while kubectl get namespace "$NAMESPACE" --context "$CONTEXT" &> /dev/null; do
            sleep 2
        done
        log_success "Namespace cleanup completed"
    fi
}

deploy_manifest() {
    local manifest=$1
    local manifest_path="infra/k8s/manifests/${manifest}"
    
    log_deploy "Deploying $manifest..."
    
    # Apply the manifest
    if ! kubectl apply -f "$manifest_path" --context "$CONTEXT"; then
        log_error "Failed to deploy $manifest"
        return 1
    fi
    
    log_success "$manifest deployed successfully"
}

deploy_all_manifests() {
    log_step "Deploying all manifests in order..."
    
    for manifest in "${MANIFESTS[@]}"; do
        deploy_manifest "$manifest"
        
        # Small delay between deployments for dependencies
        sleep 2
    done
    
    log_success "All manifests deployed"
}

#------------------------------------------------------------------------------
# Waiting Functions
#------------------------------------------------------------------------------
wait_for_namespace() {
    log_info "Waiting for namespace to be Active..."
    local deadline=$((SECONDS + ${TIMEOUT}))
    while true; do
        phase=$(kubectl get namespace "$NAMESPACE" --context "$CONTEXT" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
        if [ "$phase" = "Active" ]; then
            log_success "Namespace is Active"
            return 0
        fi
        if [ $SECONDS -ge $deadline ]; then
            log_warning "Namespace not Active after ${TIMEOUT}s (phase='${phase:-unknown}'); continuing"
            return 0
        fi
        sleep 2
    done
}

wait_for_redis() {
    log_info "Waiting for Redis to be ready..."
    
    # Wait for StatefulSet to be ready
    if ! kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=quadratic-cloud-redis \
        -n "$NAMESPACE" --context "$CONTEXT" --timeout="${TIMEOUT}s"; then
        log_error "Redis failed to become ready within ${TIMEOUT}s"
        show_debug_info "redis"
        return 1
    fi
    
    # Test Redis connectivity
    log_info "Testing Redis connectivity..."
    local redis_test_result
    redis_test_result=$(kubectl exec statefulset/quadratic-cloud-redis -n "$NAMESPACE" --context "$CONTEXT" \
        -- redis-cli ping 2>/dev/null || echo "FAILED")
    
    if [ "$redis_test_result" = "PONG" ]; then
        log_success "Redis is ready and responding"
    else
        log_error "Redis connectivity test failed"
        return 1
    fi
}

wait_for_controller() {
    log_info "Waiting for Controller to be ready..."
    
    # Wait for Deployment to be available
    if ! kubectl wait --for=condition=available deployment/quadratic-cloud-controller \
        -n "$NAMESPACE" --context "$CONTEXT" --timeout="${TIMEOUT}s"; then
        log_error "Controller failed to become ready within ${TIMEOUT}s"
        show_debug_info "controller"
        return 1
    fi
    
    # Test Controller health endpoint
    log_info "Testing Controller health..."
    local health_check_attempts=0
    local max_health_attempts=30
    
    while [ $health_check_attempts -lt $max_health_attempts ]; do
        if kubectl exec deployment/quadratic-cloud-controller -n "$NAMESPACE" --context "$CONTEXT" \
            -- curl -f -s http://localhost:3004/health &> /dev/null; then
            log_success "Controller health check passed"
            return 0
        fi
        
        sleep 2
        ((health_check_attempts++))
    done
    
    log_warning "Controller health check failed after ${max_health_attempts} attempts"
    log_info "Controller may still be starting up..."
}

wait_for_all_services() {
    if [ "$WAIT_FOR_READY" = false ]; then
        log_info "Skipping wait for services (--no-wait specified)"
        return 0
    fi
    
    log_step "Waiting for all services to be ready..."
    
    wait_for_namespace
    wait_for_redis
    wait_for_controller
    
    log_success "All services are ready"
}

#------------------------------------------------------------------------------
# Verification Functions
#------------------------------------------------------------------------------
verify_deployment() {
    log_step "Verifying deployment..."
    
    # Check all resources
    log_info "Checking all resources:"
    kubectl get all -n "$NAMESPACE" --context "$CONTEXT"
    
    # Check persistent volumes
    log_info "Checking persistent volumes:"
    kubectl get pvc -n "$NAMESPACE" --context "$CONTEXT"
    
    # Check secrets and configmaps
    log_info "Checking configuration:"
    kubectl get configmaps,secrets -n "$NAMESPACE" --context "$CONTEXT"
    
    # Check recent events
    log_info "Recent events:"
    kubectl get events -n "$NAMESPACE" --context "$CONTEXT" \
        --sort-by='.lastTimestamp' | tail -10
    
    log_success "Deployment verification completed"
}

#------------------------------------------------------------------------------
# Debug Functions
#------------------------------------------------------------------------------
show_debug_info() {
    local component=${1:-"all"}
    
    log_warning "Showing debug information for: $component"
    
    case $component in
        "redis")
            echo "Redis Pod Status:"
            kubectl describe pod -l app.kubernetes.io/name=quadratic-cloud-redis -n "$NAMESPACE" --context "$CONTEXT"
            echo "Redis Logs:"
            kubectl logs -l app.kubernetes.io/name=quadratic-cloud-redis -n "$NAMESPACE" --context "$CONTEXT" --tail=20
            ;;
        "controller")
            echo "Controller Pod Status:"
            kubectl describe pod -l app.kubernetes.io/name=quadratic-cloud-controller -n "$NAMESPACE" --context "$CONTEXT"
            echo "Controller Logs:"
            kubectl logs -l app.kubernetes.io/name=quadratic-cloud-controller -n "$NAMESPACE" --context "$CONTEXT" --tail=20
            ;;
        *)
            echo "All Pod Status:"
            kubectl get pods -n "$NAMESPACE" --context "$CONTEXT" -o wide
            echo "All Events:"
            kubectl get events -n "$NAMESPACE" --context "$CONTEXT" --sort-by='.lastTimestamp'
            ;;
    esac
}

#------------------------------------------------------------------------------
# Information Display Functions
#------------------------------------------------------------------------------
show_access_info() {
    echo
    log_success "🎉 Quadratic Cloud deployed successfully!"
    echo
    log_info "📋 Deployment Information:"
    echo "  • Namespace: $NAMESPACE"
    echo "  • Context: $CONTEXT"
    echo "  • Controller: quadratic-cloud-controller:3004"
    echo "  • Redis: quadratic-cloud-redis:6379"
    echo
    log_info "🔗 Access Commands:"
    echo "  • Controller API:"
    echo "    kubectl port-forward svc/quadratic-cloud-controller 3004:3004 -n $NAMESPACE"
    echo "  • Controller Metrics:"
    echo "    kubectl port-forward svc/quadratic-cloud-controller 9090:9090 -n $NAMESPACE"
    echo "  • Redis Direct Access:"
    echo "    kubectl port-forward svc/quadratic-cloud-redis 6379:6379 -n $NAMESPACE"
    echo "  • Start local tunnels:"
    echo "    ./infra/k8s/scripts/tunnel.sh start --namespace $NAMESPACE --name quadratic-localhost-tunnel --ports \"8000:8000,3001:3001,3002:3002,3003:3003\""
    echo
    log_info "📊 Monitoring Commands:"
    echo "  • Watch all resources:"
    echo "    kubectl get all -n $NAMESPACE -w"
    echo "  • Watch worker jobs:"
    echo "    kubectl get jobs -l app.kubernetes.io/component=worker -n $NAMESPACE -w"
    echo "  • View logs:"
    echo "    ./infra/k8s/scripts/logs.sh"
    echo
    log_info "📁 Next Steps:"
    echo "  • Test the system: ./infra/k8s/scripts/test.sh"
    echo "  • View logs: ./infra/k8s/scripts/logs.sh"
    echo "  • Port forward: kubectl port-forward svc/quadratic-cloud-controller 3004:3004 -n $NAMESPACE"
    echo
}

#------------------------------------------------------------------------------
# Cleanup on Error
#------------------------------------------------------------------------------
cleanup_on_error() {
    local exit_code=$?
    log_error "Deployment failed with exit code $exit_code"
    
    show_debug_info
    
    if [ "$FORCE_DEPLOY" = true ]; then
        log_info "Force mode was enabled. Consider cleaning up:"
        echo "  kubectl delete namespace $NAMESPACE --context $CONTEXT"
    fi
    
    exit $exit_code
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    echo -e "${BLUE}🚀 Deploying Quadratic Cloud System${NC}"
    echo
    
    # Parse command line arguments
    parse_args "$@"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Set up error handling
    trap cleanup_on_error ERR
    
    # Execute deployment steps
    check_deployment_environment
    force_cleanup_namespace
    deploy_all_manifests
    wait_for_all_services
    verify_deployment
    show_access_info
    
    log_success "Deployment completed successfully!"
}

# Run main function with all arguments
main "$@"
