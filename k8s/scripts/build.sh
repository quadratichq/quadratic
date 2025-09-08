#!/bin/bash

#==============================================================================
# Quadratic Cloud - Docker Image Builder
#==============================================================================
# This script builds Docker images for the Quadratic Cloud system components
# and pushes them to the local registry for use in the Kubernetes cluster.
#
# What it does:
# - Validates the build environment
# - Builds controller and worker Docker images with optimization
# - Tags images for local registry
# - Pushes images to local registry
# - Verifies image availability in cluster
#
# Usage: ./k8s/scripts/build.sh [OPTIONS]
# Options:
#   --no-cache      Build without using Docker cache
#   --push-only     Only push existing images (skip build)
#   --parallel      Build images in parallel (default)
#   --sequential    Build images sequentially
#   --tag TAG       Custom tag (default: latest)
#   --registry URL  Custom registry URL (default: localhost:5001)
#==============================================================================

set -e  # Exit on any error
set -u  # Exit on undefined variables

#------------------------------------------------------------------------------
# Configuration Constants
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Default configuration
REGISTRY="localhost:5001"
CLUSTER_NAME="quadratic-cloud"
VERSION="latest"
USE_CACHE=true
PUSH_ONLY=false
BUILD_PARALLEL=true

# Component definitions
readonly COMPONENTS=("controller" "worker")
declare -A COMPONENT_PATHS=(
    ["controller"]="quadratic-cloud-controller"
    ["worker"]="quadratic-cloud-worker"
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

log_build() {
    echo -e "${CYAN}🔨 $1${NC}"
}

#------------------------------------------------------------------------------
# Help Function
#------------------------------------------------------------------------------
show_help() {
    cat << EOF
Quadratic Cloud - Docker Image Builder

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --no-cache        Build without using Docker cache
    --push-only       Only push existing images (skip build)
    --parallel        Build images in parallel (default)
    --sequential      Build images sequentially
    --tag TAG         Custom tag (default: latest)
    --registry URL    Custom registry URL (default: localhost:5001)
    --help            Show this help message

EXAMPLES:
    $0                          # Build all images with cache
    $0 --no-cache               # Build without cache
    $0 --tag v1.0.0             # Build with custom tag
    $0 --push-only              # Only push existing images

COMPONENTS:
    controller    Quadratic Cloud Controller (orchestrator)
    worker        Quadratic Cloud Worker (file processor)

EOF
}

#------------------------------------------------------------------------------
# Parse Command Line Arguments
#------------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-cache)
                USE_CACHE=false
                shift
                ;;
            --push-only)
                PUSH_ONLY=true
                shift
                ;;
            --parallel)
                BUILD_PARALLEL=true
                shift
                ;;
            --sequential)
                BUILD_PARALLEL=false
                shift
                ;;
            --tag)
                VERSION="$2"
                shift 2
                ;;
            --registry)
                REGISTRY="$2"
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
check_build_environment() {
    log_step "Checking build environment..."
    
    # Check if we're in the right directory
    if [ ! -d "quadratic-cloud-controller" ] || [ ! -d "quadratic-cloud-worker" ]; then
        log_error "Build must be run from project root directory"
        log_info "Expected directories: quadratic-cloud-controller, quadratic-cloud-worker"
        log_info "Current directory: $(pwd)"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        log_info "Start Docker with: sudo systemctl start docker"
        exit 1
    fi
    
    # Check if local registry is running (if using default)
    if [[ "$REGISTRY" == localhost:* ]]; then
        local port="${REGISTRY#localhost:}"
        if ! curl -s "http://localhost:${port}/v2/_catalog" &> /dev/null; then
            log_error "Local registry is not running on ${REGISTRY}"
            log_info "Run setup first: ./k8s/scripts/setup.sh"
            exit 1
        fi
    fi
    
    # Check component directories and Docker files
    for component in "${COMPONENTS[@]}"; do
        local component_path="${COMPONENT_PATHS[$component]}"
        if [ ! -f "${component_path}/Dockerfile" ]; then
            log_error "Dockerfile not found: ${component_path}/Dockerfile"
            exit 1
        fi
    done
    
    log_success "Build environment is ready"
}

#------------------------------------------------------------------------------
# Build Functions
#------------------------------------------------------------------------------
build_image() {
    local component=$1
    local component_path="${COMPONENT_PATHS[$component]}"
    local image_name="quadratic-cloud-${component}"
    local full_image_name="${REGISTRY}/${image_name}:${VERSION}"
    
    log_build "Building ${component}..."
    
    # Skip build if push-only mode
    if [ "$PUSH_ONLY" = true ]; then
        log_info "Skipping build for ${component} (push-only mode)"
        push_image "$component"
        return
    fi
    
    # Prepare build arguments
    local build_args=(
        "--file" "${component_path}/Dockerfile"
        "--tag" "${image_name}:${VERSION}"
        "--tag" "${image_name}:latest"
        "--tag" "${full_image_name}"
        "--progress=plain"
    )
    
    # Add cache options
    if [ "$USE_CACHE" = false ]; then
        build_args+=("--no-cache")
    else
        build_args+=("--build-arg" "BUILDKIT_INLINE_CACHE=1")
    fi
    
    # Add build context (project root for shared dependencies)
    build_args+=(".")
    
    # Build the image
    log_info "Docker build command: docker build ${build_args[*]}"
    
    if ! docker build "${build_args[@]}"; then
        log_error "Failed to build ${component}"
        return 1
    fi
    
    # Push to registry
    push_image "$component"
    
    log_success "${component} built and pushed successfully"
}

push_image() {
    local component=$1
    local image_name="quadratic-cloud-${component}"
    local full_image_name="${REGISTRY}/${image_name}:${VERSION}"
    
    log_info "Pushing ${full_image_name} to registry..."
    
    if ! docker push "${full_image_name}"; then
        log_error "Failed to push ${component} to registry"
        return 1
    fi
    
    # Also push as latest if not already latest
    if [ "$VERSION" != "latest" ]; then
        local latest_image="${REGISTRY}/${image_name}:latest"
        docker tag "${full_image_name}" "${latest_image}"
        docker push "${latest_image}"
    fi
}

build_all_parallel() {
    log_step "Building all components in parallel..."
    
    local pids=()
    
    # Start builds in background
    for component in "${COMPONENTS[@]}"; do
        (
            build_image "$component"
        ) &
        pids+=($!)
    done
    
    # Wait for all builds to complete
    local failed=false
    for i in "${!pids[@]}"; do
        local pid=${pids[i]}
        local component=${COMPONENTS[i]}
        
        if wait $pid; then
            log_success "${component} build completed"
        else
            log_error "${component} build failed"
            failed=true
        fi
    done
    
    if [ "$failed" = true ]; then
        log_error "One or more builds failed"
        return 1
    fi
}

build_all_sequential() {
    log_step "Building all components sequentially..."
    
    for component in "${COMPONENTS[@]}"; do
        build_image "$component"
    done
}

#------------------------------------------------------------------------------
# Verification Functions
#------------------------------------------------------------------------------
verify_images() {
    log_step "Verifying built images..."
    
    # Check local images
    log_info "Local images:"
    for component in "${COMPONENTS[@]}"; do
        local image_name="quadratic-cloud-${component}"
        if docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep "$image_name"; then
            log_success "${image_name} found locally"
        else
            log_error "${image_name} not found locally"
        fi
    done
    
    # Check registry images
    log_info "Registry images:"
    if curl -s "http://${REGISTRY}/v2/_catalog" | jq -r '.repositories[]' 2>/dev/null | grep -q "quadratic-cloud"; then
        log_success "Images found in registry"
    else
        log_warning "Could not verify images in registry"
    fi
    
    # Test image pull from cluster perspective
    if command -v kind &> /dev/null && kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        log_info "Testing image accessibility from cluster..."
        for component in "${COMPONENTS[@]}"; do
            local image_name="quadratic-cloud-${component}"
            local full_image_name="${REGISTRY}/${image_name}:${VERSION}"
            
            if docker exec "${CLUSTER_NAME}-control-plane" crictl images | grep -q "$image_name"; then
                log_success "${image_name} accessible from cluster"
            else
                log_info "Pre-loading ${image_name} into cluster..."
                kind load docker-image "${full_image_name}" --name "${CLUSTER_NAME}"
            fi
        done
    fi
}

#------------------------------------------------------------------------------
# Information Display Functions
#------------------------------------------------------------------------------
show_build_info() {
    echo
    log_success "🎉 All images built successfully!"
    echo
    log_info "📋 Build Information:"
    echo "  • Registry: ${REGISTRY}"
    echo "  • Version/Tag: ${VERSION}"
    echo "  • Cache Used: ${USE_CACHE}"
    echo "  • Build Mode: $([ "$BUILD_PARALLEL" = true ] && echo "Parallel" || echo "Sequential")"
    echo
    log_info "🐳 Built Images:"
    for component in "${COMPONENTS[@]}"; do
        echo "  • quadratic-cloud-${component}:${VERSION}"
        echo "    └─ ${REGISTRY}/quadratic-cloud-${component}:${VERSION}"
    done
    echo
    log_info "📁 Next Steps:"
    echo "  • Deploy to cluster: ./k8s/scripts/deploy.sh"
    echo "  • View images: docker images | grep quadratic-cloud"
    echo "  • Check registry: curl http://${REGISTRY}/v2/_catalog"
    echo
}

#------------------------------------------------------------------------------
# Cleanup Functions
#------------------------------------------------------------------------------
cleanup_build_artifacts() {
    log_info "Cleaning up build artifacts..."
    
    # Remove dangling images
    if docker images -f "dangling=true" -q | grep -q .; then
        docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
    fi
    
    # Remove build cache (optional, uncomment if needed)
    docker builder prune -f
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    echo -e "${BLUE}🔨 Building Quadratic Cloud Docker Images${NC}"
    echo
    
    # Parse command line arguments
    parse_args "$@"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Execute build steps
    check_build_environment
    
    if [ "$BUILD_PARALLEL" = true ]; then
        build_all_parallel
    else
        build_all_sequential
    fi
    
    verify_images
    cleanup_build_artifacts
    show_build_info
    
    log_success "Build completed successfully!"
}

# Run main function with all arguments
main "$@"
