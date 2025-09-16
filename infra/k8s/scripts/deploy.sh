#!/bin/bash

#==============================================================================
# Quadratic Cloud - Kubernetes Deployment Script
#==============================================================================
# This script deploys the complete Quadratic Cloud system to Kubernetes
# in the correct order with proper dependency handling and verification.
#
# What it does:
# - Validates the deployment environment
# - Creates secrets from .env file
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
readonly K8S_DIR="${PROJECT_ROOT}/infra/k8s"

# Default configuration
NAMESPACE="quadratic-cloud"
CLUSTER_NAME="quadratic-cloud"
CONTEXT="kind-${CLUSTER_NAME}"
FORCE_DEPLOY=false
WAIT_FOR_READY=true
TIMEOUT=300

# Controller scheduling requirements
readonly CONTROLLER_NODE_LABEL_KEY="quadratic.io/node-role"
readonly CONTROLLER_NODE_LABEL_VALUE="controller"

# Manifest files in deployment order (dependencies first)
readonly MANIFESTS=(
    "01-namespace.yaml"
    "02-rbac.yaml"
    "03-network-policies.yaml"
    "04-redis.yaml"
    "05-controller.yaml"
    "06-monitoring.yaml"
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
    2. Secrets from .env file
    3. Redis database with persistence
    4. RBAC (roles and service accounts)
    5. Controller application
    6. Monitoring resources

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
    
    # Check .env file exists
    if [ ! -f "${K8S_DIR}/.env" ]; then
        log_error ".env file not found at ${K8S_DIR}/.env"
        log_info "Create your .env file with all configuration variables"
        exit 1
    fi
    
    # Check manifest files
    for manifest in "${MANIFESTS[@]}"; do
        local manifest_path="${K8S_DIR}/manifests/${manifest}"
        if [ ! -f "$manifest_path" ]; then
            log_error "Manifest not found: $manifest_path"
            exit 1
        fi
    done
    
    log_success "Deployment environment is ready"
    log_info "Target cluster: $CONTEXT"
    log_info "Target namespace: $NAMESPACE"
    log_info "Config file: ${K8S_DIR}/.env"
}

#------------------------------------------------------------------------------
# Cluster Preparation Functions
#------------------------------------------------------------------------------
is_kind_context() {
    [[ "$CONTEXT" == kind-* ]]
}

is_kind_cluster() {
    local provider
    provider=$(kubectl get nodes --context "$CONTEXT" -o jsonpath='{range .items[0]}{.spec.providerID}{end}' 2>/dev/null || true)
    [[ "$provider" == kind://* ]]
}

ensure_controller_node_label() {
    log_step "Ensuring controller scheduling node is available..."

    local label_selector="${CONTROLLER_NODE_LABEL_KEY}=${CONTROLLER_NODE_LABEL_VALUE}"

    if kubectl get nodes --context "$CONTEXT" -l "$label_selector" -o name | grep -q .; then
        log_success "Found node(s) with $label_selector"
        return 0
    fi

    if is_kind_context || is_kind_cluster; then
        log_info "No node labeled $label_selector; auto-labeling a Ready worker (kind cluster detected)"

        # Prefer kind workers (have worker-id), fallback to non-control-plane nodes
        mapfile -t candidates < <(kubectl get nodes --context "$CONTEXT" \
            -l 'worker-id' \
            -o jsonpath='{range .items}{.metadata.name}{"\n"}{end}')

        if [ ${#candidates[@]} -eq 0 ]; then
            mapfile -t candidates < <(kubectl get nodes --context "$CONTEXT" \
                -l '!node-role.kubernetes.io/control-plane' \
                -o jsonpath='{range .items}{.metadata.name}{"\n"}{end}')
        fi

        local chosen=""
        for n in "${candidates[@]}"; do
            [ -z "$n" ] && continue
            local ready unsched
            ready=$(kubectl get node "$n" --context "$CONTEXT" -o jsonpath='{range .status.conditions[?(@.type=="Ready")]}{.status}{end}')
            unsched=$(kubectl get node "$n" --context "$CONTEXT" -o jsonpath='{.spec.unschedulable}')
            if [ "$ready" = "True" ] && [ "${unsched:-false}" != "true" ]; then
                chosen="$n"
                break
            fi
        done

        if [ -z "$chosen" ]; then
            log_error "No Ready, schedulable worker nodes available to label for controller."
            log_info "Add a worker node and label it manually:"
            echo "  kubectl label node <node-name> ${CONTROLLER_NODE_LABEL_KEY}=${CONTROLLER_NODE_LABEL_VALUE} --context $CONTEXT"
            exit 1
        fi

        kubectl label node "$chosen" "${CONTROLLER_NODE_LABEL_KEY}=${CONTROLLER_NODE_LABEL_VALUE}" --overwrite --context "$CONTEXT"
        log_success "Labeled node '$chosen' with ${CONTROLLER_NODE_LABEL_KEY}=${CONTROLLER_NODE_LABEL_VALUE}"
    else
        log_error "No node labeled ${label_selector} found."
        log_info "To proceed, label a node explicitly via your infra pipeline or:"
        echo "  kubectl label node <node-name> ${CONTROLLER_NODE_LABEL_KEY}=${CONTROLLER_NODE_LABEL_VALUE} --context $CONTEXT"
        exit 1
    fi
}

#------------------------------------------------------------------------------
# Secret Management Functions
#------------------------------------------------------------------------------
create_secrets_from_env() {
    log_step "Creating secrets from .env file..."
    
    # Check if .env file exists
    if [ ! -f "${K8S_DIR}/.env" ]; then
        log_error ".env file not found at ${K8S_DIR}/.env"
        exit 1
    fi
    
    # Ensure namespace exists first (deploy namespace manifest if needed)
    if ! kubectl get namespace "$NAMESPACE" --context "$CONTEXT" &> /dev/null; then
        log_info "Namespace doesn't exist, creating it first..."
        if [ -f "${K8S_DIR}/manifests/01-namespace.yaml" ]; then
            kubectl apply -f "${K8S_DIR}/manifests/01-namespace.yaml" --context "$CONTEXT"
        else
            kubectl create namespace "$NAMESPACE" --context "$CONTEXT"
        fi
    fi
    
    log_deploy "Creating secret 'quadratic-cloud-controller-secrets' from .env file..."
    
    # Create or update secret from .env file
    if ! kubectl create secret generic quadratic-cloud-controller-secrets \
        --from-env-file="${K8S_DIR}/.env" \
        --namespace="$NAMESPACE" \
        --context="$CONTEXT" \
        --dry-run=client -o yaml | kubectl apply -f - --context "$CONTEXT"; then
        log_error "Failed to create secrets from .env file"
        return 1
    fi
    
    # Verify secret was created
    if kubectl get secret quadratic-cloud-controller-secrets -n "$NAMESPACE" --context "$CONTEXT" &> /dev/null; then
        log_success "Secret created successfully from .env file"
        
        # Show non-sensitive info about the secret
        local secret_keys
        secret_keys=$(kubectl get secret quadratic-cloud-controller-secrets -n "$NAMESPACE" --context "$CONTEXT" -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null | wc -l || echo "unknown")
        log_info "Secret contains $secret_keys configuration keys"
    else
        log_error "Secret verification failed"
        return 1
    fi
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
    local manifest_path="${K8S_DIR}/manifests/${manifest}"
    
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
            
            # Test JWKS endpoint
            log_info "Testing JWKS endpoint..."
            if kubectl exec deployment/quadratic-cloud-controller -n "$NAMESPACE" --context "$CONTEXT" \
                -- curl -f -s http://localhost:3004/.well-known/jwks.json | grep -q "keys"; then
                log_success "JWKS endpoint is working"
            else
                log_warning "JWKS endpoint test failed, but controller is healthy"
            fi
            
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
    
    # Verify secret has expected keys
    log_info "Verifying secret configuration:"
    if kubectl get secret quadratic-cloud-controller-secrets -n "$NAMESPACE" --context "$CONTEXT" -o jsonpath='{.data}' | grep -q "JWT_ENCODING_KEY"; then
        log_success "JWT encoding key found in secret"
    else
        log_warning "JWT encoding key not found in secret - check your .env file"
    fi
    
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
    echo "  • Config: .env file with secrets"
    echo
    log_info "🔗 Access Commands:"
    echo "  • Controller API:"
    echo "    kubectl port-forward svc/quadratic-cloud-controller 3004:3004 -n $NAMESPACE"
    echo "  • Controller JWKS:"
    echo "    curl http://localhost:3004/.well-known/jwks.json"
    echo "  • Controller Metrics:"
    echo "    kubectl port-forward svc/quadratic-cloud-controller 9090:9090 -n $NAMESPACE"
    echo "  • Redis Direct Access:"
    echo "    kubectl port-forward svc/quadratic-cloud-redis 6379:6379 -n $NAMESPACE"
    echo
    log_info "📊 Monitoring Commands:"
    echo "  • Watch all resources:"
    echo "    kubectl get all -n $NAMESPACE -w"
    echo "  • Watch worker jobs:"
    echo "    kubectl get jobs -l app.kubernetes.io/component=worker -n $NAMESPACE -w"
    echo "  • View logs:"
    echo "    kubectl logs -l app.kubernetes.io/name=quadratic-cloud-controller -n $NAMESPACE -f"
    echo
    log_info "🔧 Configuration Management:"
    echo "  • Update secrets from .env:"
    echo "    kubectl create secret generic quadratic-cloud-controller-secrets \\"
    echo "      --from-env-file=.env --namespace=$NAMESPACE --dry-run=client -o yaml | kubectl apply -f -"
    echo "  • Restart controller after secret update:"
    echo "    kubectl rollout restart deployment/quadratic-cloud-controller -n $NAMESPACE"
    echo
    log_info "📁 Next Steps:"
    echo "  • Test the JWKS endpoint: curl http://localhost:3004/.well-known/jwks.json (after port-forward)"
    echo "  • View controller logs: kubectl logs -l app.kubernetes.io/name=quadratic-cloud-controller -n $NAMESPACE -f"
    echo "  • Update .env and redeploy: ./infra/k8s/scripts/deploy.sh --force"
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
    ensure_controller_node_label
    force_cleanup_namespace
    create_secrets_from_env
    deploy_all_manifests
    wait_for_all_services
    verify_deployment
    show_access_info
    
    log_success "Deployment completed successfully!"
}

# Run main function with all arguments
main "$@"
