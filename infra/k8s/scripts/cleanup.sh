#!/bin/bash

#==============================================================================
# Quadratic Cloud - Cleanup Script
#==============================================================================
# This script provides various cleanup options for the Quadratic Cloud
# development environment, from simple namespace cleanup to complete
# environment teardown.
#
# Usage: ./infra/k8s/scripts/cleanup.sh [TYPE] [OPTIONS]
# Types: namespace, cluster, registry, images, all
# Options:
#   --force       Skip confirmation prompts
#   --keep-data   Keep persistent volumes when cleaning namespace
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

CLEANUP_TYPE="namespace"
NAMESPACE="quadratic-cloud"
CLUSTER_NAME="quadratic-cloud"
REGISTRY_NAME="kind-registry"
FORCE_MODE=false
KEEP_DATA=false

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
    echo -e "${PURPLE}🧹 $1${NC}"
}

#------------------------------------------------------------------------------
# Help Function
#------------------------------------------------------------------------------
show_help() {
    cat << EOF
Quadratic Cloud - Cleanup Script

USAGE:
    $0 [TYPE] [OPTIONS]

CLEANUP TYPES:
    namespace     Remove only the quadratic-cloud namespace (default)
    cluster       Remove namespace and kind cluster
    registry      Remove local Docker registry
    images        Remove built Docker images
    all           Remove everything (namespace, cluster, registry, images)

OPTIONS:
    --force       Skip confirmation prompts
    --keep-data   Keep persistent volumes when cleaning namespace
    --help        Show this help

EXAMPLES:
    $0                    # Clean namespace only
    $0 cluster            # Clean namespace and cluster
    $0 all --force        # Clean everything without confirmation
    $0 namespace --keep-data  # Clean namespace but keep PVs

WHAT GETS CLEANED:
    namespace:  Quadratic Cloud pods, services, configs
    cluster:    Complete kind Kubernetes cluster
    registry:   Local Docker registry container
    images:     Built quadratic-cloud Docker images

EOF
}

#------------------------------------------------------------------------------
# Parse Arguments
#------------------------------------------------------------------------------
parse_args() {
    # First argument might be cleanup type
    if [ $# -gt 0 ] && [[ "$1" =~ ^(namespace|cluster|registry|images|all)$ ]]; then
        CLEANUP_TYPE="$1"
        shift
    fi
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_MODE=true
                shift
                ;;
            --keep-data)
                KEEP_DATA=true
                shift
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
# Confirmation Functions
#------------------------------------------------------------------------------
confirm_action() {
    local action="$1"
    
    if [ "$FORCE_MODE" = true ]; then
        return 0
    fi
    
    echo
    log_warning "About to $action"
    read -p "Are you sure? [y/N]: " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
}

#------------------------------------------------------------------------------
# Cleanup Functions
#------------------------------------------------------------------------------
cleanup_namespace() {
    log_step "Cleaning up namespace: $NAMESPACE"
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Namespace $NAMESPACE not found"
        return 0
    fi
    
    # Show what will be deleted
    log_info "Resources to be deleted:"
    kubectl get all -n "$NAMESPACE" || true
    
    if [ "$KEEP_DATA" = false ]; then
        kubectl get pvc -n "$NAMESPACE" || true
    fi
    
    confirm_action "delete namespace $NAMESPACE"
    
    if [ "$KEEP_DATA" = true ]; then
        # Delete everything except PVCs
        log_info "Deleting resources (keeping persistent volumes)..."
        kubectl delete all --all -n "$NAMESPACE" || true
        kubectl delete configmaps,secrets,serviceaccounts,roles,rolebindings --all -n "$NAMESPACE" || true
        
        log_success "Namespace resources cleaned (PVCs preserved)"
    else
        # Delete entire namespace
        log_info "Deleting entire namespace..."
        kubectl delete namespace "$NAMESPACE" --wait=true
        
        log_success "Namespace deleted completely"
    fi
}

cleanup_cluster() {
    log_step "Cleaning up kind cluster: $CLUSTER_NAME"
    
    if ! command -v kind &> /dev/null; then
        log_error "kind not found"
        return 1
    fi
    
    if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        log_info "Cluster $CLUSTER_NAME not found"
        return 0
    fi
    
    confirm_action "delete kind cluster $CLUSTER_NAME"
    
    kind delete cluster --name "$CLUSTER_NAME"
    log_success "Kind cluster deleted"
}

cleanup_registry() {
    log_step "Cleaning up local registry: $REGISTRY_NAME"
    
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
        log_info "Registry $REGISTRY_NAME not found"
        return 0
    fi
    
    confirm_action "delete local registry $REGISTRY_NAME"
    
    # Stop and remove registry container
    docker stop "$REGISTRY_NAME" &> /dev/null || true
    docker rm "$REGISTRY_NAME" &> /dev/null || true
    
    log_success "Local registry removed"
}

cleanup_images() {
    log_step "Cleaning up Docker images"
    
    # Find quadratic-cloud images
    local images
    images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "quadratic-cloud" || true)
    
    if [ -z "$images" ]; then
        log_info "No quadratic-cloud images found"
        return 0
    fi
    
    log_info "Images to be removed:"
    echo "$images"
    
    confirm_action "delete quadratic-cloud Docker images"
    
    # Remove images
    echo "$images" | xargs -r docker rmi -f
    
    # Clean up dangling images
    local dangling
    dangling=$(docker images -f "dangling=true" -q || true)
    if [ -n "$dangling" ]; then
        log_info "Removing dangling images..."
        echo "$dangling" | xargs -r docker rmi -f
    fi
    
    log_success "Docker images cleaned"
}

#------------------------------------------------------------------------------
# Status Functions
#------------------------------------------------------------------------------
show_cleanup_plan() {
    echo -e "${BLUE}🧹 Quadratic Cloud Cleanup${NC}"
    echo
    log_info "📋 Cleanup Plan:"
    
    case "$CLEANUP_TYPE" in
        "namespace")
            echo "  • Remove namespace: $NAMESPACE"
            if [ "$KEEP_DATA" = true ]; then
                echo "  • Keep persistent volumes"
            else
                echo "  • Remove persistent volumes"
            fi
            ;;
        "cluster")
            echo "  • Remove namespace: $NAMESPACE"
            echo "  • Remove kind cluster: $CLUSTER_NAME"
            ;;
        "registry")
            echo "  • Remove local registry: $REGISTRY_NAME"
            ;;
        "images")
            echo "  • Remove quadratic-cloud Docker images"
            echo "  • Remove dangling images"
            ;;
        "all")
            echo "  • Remove namespace: $NAMESPACE"
            echo "  • Remove kind cluster: $CLUSTER_NAME"
            echo "  • Remove local registry: $REGISTRY_NAME"
            echo "  • Remove Docker images"
            ;;
    esac
    
    echo
}

show_restart_info() {
    case "$CLEANUP_TYPE" in
        "namespace")
            log_info "📁 To restart the application:"
            echo "  ./infra/k8s/scripts/deploy.sh"
            echo "  ./infra/k8s/scripts/tunnel.sh"
            ;;
        "cluster")
            log_info "📁 To restart the environment:"
            echo "  ./infra/k8s/scripts/setup.sh"
            echo "  ./infra/k8s/scripts/build.sh"
            echo "  ./infra/k8s/scripts/deploy.sh"
            echo "  ./infra/k8s/scripts/tunnel.sh"
            ;;
        "registry")
            log_info "📁 To restart with registry:"
            echo "  ./infra/k8s/scripts/setup.sh"
            echo "  ./infra/k8s/scripts/build.sh"
            ;;
        "images")
            log_info "📁 To rebuild images:"
            echo "  ./infra/k8s/scripts/build.sh"
            ;;
        "all")
            log_info "📁 To restart from scratch:"
            echo "  ./infra/k8s/scripts/setup.sh"
            echo "  ./infra/k8s/scripts/build.sh"
            echo "  ./infra/k8s/scripts/deploy.sh"
            echo "  ./infra/k8s/scripts/tunnel.sh"
            ;;
    esac
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    # Parse arguments
    parse_args "$@"
    
    # Show cleanup plan
    show_cleanup_plan
    
    # Execute cleanup based on type
    case "$CLEANUP_TYPE" in
        "namespace")
            cleanup_namespace
            ;;
        "cluster")
            cleanup_namespace
            cleanup_cluster
            ;;
        "registry")
            cleanup_registry
            ;;
        "images")
            cleanup_images
            ;;
        "all")
            cleanup_namespace
            cleanup_cluster
            cleanup_registry
            cleanup_images
            ;;
        *)
            log_error "Unknown cleanup type: $CLEANUP_TYPE"
            show_help
            exit 1
            ;;
    esac
    
    echo
    log_success "🎉 Cleanup completed successfully!"
    show_restart_info
}

# Run main function
main "$@"
