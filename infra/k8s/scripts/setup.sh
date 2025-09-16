#!/bin/bash

#==============================================================================
# Quadratic Cloud - Local Kubernetes Environment Setup
#==============================================================================
# This script sets up a complete local Kubernetes development environment
# using kind (Kubernetes in Docker) with a local registry for fast iteration.
#
# What it does:
# - Checks all prerequisites (Docker, kubectl, kind)
# - Creates a local Docker registry for fast image pushes
# - Creates a multi-node kind cluster with proper networking
# - Configures the cluster to use the local registry
# - Sets up port mappings for local access
#
# Usage: ./infra/k8s/scripts/setup.sh [OPTIONS]
# Options:
#   --cluster-name NAME    Custom cluster name (default: quadratic-cloud)
#   --registry-port PORT   Custom registry port (default: 5001)
#   --workers N            Number of worker nodes (default: 4)
#   --force                Force recreate existing cluster
#==============================================================================

set -e  # Exit on any error
set -u  # Exit on undefined variables

#------------------------------------------------------------------------------
# Configuration Constants
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Default configuration (can be overridden by command line)
CLUSTER_NAME="quadratic-cloud"
REGISTRY_NAME="kind-registry"
REGISTRY_PORT="5001"
WORKER_NODES=4
FORCE_RECREATE=false

#------------------------------------------------------------------------------
# Color Constants for Pretty Output
#------------------------------------------------------------------------------
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'  # No Color

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

log_debug() {
    echo -e "${CYAN}🐛 $1${NC}"
}

#------------------------------------------------------------------------------
# Help Function
#------------------------------------------------------------------------------
show_help() {
    cat << EOF
Quadratic Cloud - Local Kubernetes Environment Setup

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --cluster-name NAME    Custom cluster name (default: quadratic-cloud)
    --registry-port PORT   Custom registry port (default: 5001)
    --workers N            Number of worker nodes (default: 4)
    --force                Force recreate existing cluster
    --help                 Show this help message

EXAMPLES:
    $0                                    # Basic setup
    $0 --workers 4                       # Setup with 4 worker nodes
    $0 --force --cluster-name my-cluster # Force recreate with custom name

EOF
}

#------------------------------------------------------------------------------
# Parse Command Line Arguments
#------------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cluster-name)
                CLUSTER_NAME="$2"
                REGISTRY_NAME="${CLUSTER_NAME}-registry"
                shift 2
                ;;
            --registry-port)
                REGISTRY_PORT="$2"
                shift 2
                ;;
            --workers)
                WORKER_NODES="$2"
                shift 2
                ;;
            --force)
                FORCE_RECREATE=true
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
# Prerequisite Checking Functions
#------------------------------------------------------------------------------
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    elif ! docker info &> /dev/null; then
        log_error "Docker is installed but not running"
        log_info "Start Docker with: sudo systemctl start docker"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi
    
    # Check kind
    if ! command -v kind &> /dev/null; then
        missing_tools+=("kind")
    fi
    
    # Report missing tools
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Install missing tools with:"
        for tool in "${missing_tools[@]}"; do
            case $tool in
                docker)
                    echo "  sudo apt install docker.io && sudo systemctl start docker && sudo usermod -aG docker \$USER"
                    ;;
                kubectl)
                    echo "  curl -LO https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                    echo "  sudo install kubectl /usr/local/bin/"
                    ;;
                kind)
                    echo "  curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64"
                    echo "  chmod +x ./kind && sudo mv ./kind /usr/local/bin/"
                    ;;
            esac
        done
        exit 1
    fi
    
    # Check if user is in docker group
    if ! groups "$USER" | grep -q docker; then
        log_error "User $USER is not in docker group"
        log_info "Add user to docker group: sudo usermod -aG docker $USER"
        log_info "Then logout and login again"
        exit 1
    fi
    
    # Check Docker registry port availability
    if netstat -tuln 2>/dev/null | grep -q ":${REGISTRY_PORT} "; then
        if ! docker ps --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
            log_error "Port ${REGISTRY_PORT} is already in use by another process"
            exit 1
        fi
    fi
    
    log_success "All prerequisites met"
}

#------------------------------------------------------------------------------
# Registry Management Functions
#------------------------------------------------------------------------------
setup_local_registry() {
    log_step "Setting up local Docker registry..."
    
    # Check if registry already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
        if docker ps --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
            log_info "Registry ${REGISTRY_NAME} already running on port ${REGISTRY_PORT}"
            return 0
        else
            log_info "Starting existing registry ${REGISTRY_NAME}"
            docker start "${REGISTRY_NAME}"
            sleep 2
            return 0
        fi
    fi
    
    log_info "Creating new registry ${REGISTRY_NAME} on port ${REGISTRY_PORT}"
    docker run -d \
        --restart=always \
        --name "${REGISTRY_NAME}" \
        -p "127.0.0.1:${REGISTRY_PORT}:5000" \
        registry:2
    
    # Wait for registry to be ready
    log_info "Waiting for registry to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:${REGISTRY_PORT}/v2/_catalog" &> /dev/null; then
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Registry failed to start within 30 seconds"
            exit 1
        fi
        sleep 1
    done
    
    log_success "Local registry started on port ${REGISTRY_PORT}"
}

#------------------------------------------------------------------------------
# Kind Cluster Management Functions
#------------------------------------------------------------------------------
create_kind_config() {
    local config_file="/tmp/quadratic-kind-config.yaml"
    
    log_debug "Creating kind cluster configuration..." >&2
    
    cat > "$config_file" << EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ${CLUSTER_NAME}
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  # HTTP
  - containerPort: 80
    hostPort: 8080
    protocol: TCP
  # HTTPS
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
  # Custom port for services
  - containerPort: 30000
    hostPort: 30000
    protocol: TCP
  # Controller API (for local access)
  - containerPort: 30004
    hostPort: 3004
    protocol: TCP
EOF

    # Add worker nodes with descriptive labels
    for ((i=1; i<=WORKER_NODES; i++)); do
        local role
        if (( i == 1 )); then
            role="localhost-tunnel"
        elif (( i == 2 )); then
            role="redis"
        elif (( i == 3 )); then
            role="controller"
        else
            role="worker"
        fi
        cat >> "$config_file" << EOF
- role: worker
  labels:
    worker-id: "worker-${i}"
    intended-role: "${role}"
    quadratic.io/node-purpose: "${role}"
EOF
    done

    # Add registry configuration
    cat >> "$config_file" << EOF
containerdConfigPatches:
- |-
  [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:${REGISTRY_PORT}"]
    endpoint = ["http://${REGISTRY_NAME}:5000"]
EOF

    echo "$config_file"
}

create_kind_cluster() {
    log_step "Creating kind cluster..."
    
    # Check if cluster already exists
    if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        if [ "$FORCE_RECREATE" = true ]; then
            log_warning "Force recreating existing cluster ${CLUSTER_NAME}"
            kind delete cluster --name "${CLUSTER_NAME}"
        else
            log_info "Cluster ${CLUSTER_NAME} already exists"
            kubectl cluster-info --context "kind-${CLUSTER_NAME}"
            return 0
        fi
    fi
    
    # Create cluster configuration
    local config_file
    config_file=$(create_kind_config)
    
    # Create the cluster
    log_info "Creating cluster ${CLUSTER_NAME} with ${WORKER_NODES} worker node(s)..."
    kind create cluster --config="$config_file" --wait=300s
    
    # Cleanup config file
    rm -f "$config_file"
    
    # Connect registry to cluster network
    if [ "$(docker inspect -f='{{json .NetworkSettings.Networks.kind}}' "${REGISTRY_NAME}" 2>/dev/null)" = 'null' ]; then
        log_info "Connecting registry to cluster network..."
        docker network connect "kind" "${REGISTRY_NAME}"
    fi
    
    # Document the local registry for the cluster
    log_info "Configuring cluster to use local registry..."
    kubectl apply --context "kind-${CLUSTER_NAME}" -f - << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:${REGISTRY_PORT}"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF
    
    log_success "Kind cluster created successfully"
}

get_kind_worker_nodes() {
    local ctx="kind-${CLUSTER_NAME}"
    kubectl get nodes --context "$ctx" --no-headers -o custom-columns=":metadata.name" | grep -E ".*-worker.*" | grep -v "^$" || true
}

wait_for_kind_workers_ready() {
    local ctx="kind-${CLUSTER_NAME}"
    local deadline=$((SECONDS + 300))
    
    log_info "Waiting for worker nodes to be Ready..."
    
    while true; do
        mapfile -t workers < <(get_kind_worker_nodes)
        
        # Debug output
        log_info "Found ${#workers[@]} worker nodes: ${workers[*]}"
        
        if [ ${#workers[@]} -gt 0 ]; then
            local all_ready=true
            for n in "${workers[@]}"; do
                [ -z "$n" ] && continue
                local ready
                ready=$(kubectl get node "$n" --context "$ctx" -o jsonpath='{range .status.conditions[?(@.type=="Ready")]}{.status}{end}' 2>/dev/null || echo "Unknown")
                log_info "Node $n status: $ready"
                if [ "$ready" != "True" ]; then
                    all_ready=false
                    break
                fi
            done
            if $all_ready; then
                log_success "All worker nodes are Ready"
                return 0
            fi
        fi
        
        if [ $SECONDS -ge $deadline ]; then
            log_error "Worker nodes did not become Ready in time"
            kubectl get nodes --context "$ctx"
            exit 1
        fi
        sleep 2
    done
}

configure_local_node_roles() {
    log_step "Configuring node roles and taints for local cluster..."
    local ctx="kind-${CLUSTER_NAME}"

    wait_for_kind_workers_ready
    mapfile -t workers < <(get_kind_worker_nodes)

    if [ ${#workers[@]} -lt 4 ]; then
        log_error "Need at least 4 worker nodes for redis, controller, and workers. Found ${#workers[@]}"
        log_info "Recreate with: ./infra/k8s/scripts/setup.sh --workers 4 --force"
        exit 1
    fi

    # First worker → localhost-tunnel
    local tunnel_node="${workers[0]}"
    kubectl label node "$tunnel_node" quadratic.io/node-role=localhost-tunnel --overwrite --context "$ctx"
    kubectl taint node "$tunnel_node" quadratic.io/dedicated=localhost-tunnel:NoSchedule --overwrite --context "$ctx" || true

    # Second worker → redis
    local redis_node="${workers[1]}"
    kubectl label node "$redis_node" quadratic.io/node-role=redis --overwrite --context "$ctx"
    kubectl taint node "$redis_node" quadratic.io/dedicated=redis:NoSchedule --overwrite --context "$ctx" || true

    # Second worker → cloud controller
    local controller_node="${workers[2]}"
    kubectl label node "$controller_node" quadratic.io/node-role=controller --overwrite --context "$ctx"
    kubectl taint node "$controller_node" quadratic.io/dedicated=controller:NoSchedule --overwrite --context "$ctx" || true

    # Remaining workers → cloud workers
    for n in "${workers[@]:3}"; do
        kubectl label node "$n" quadratic.io/node-role=worker --overwrite --context "$ctx"
        kubectl taint node "$n" quadratic.io/dedicated=worker:NoSchedule --overwrite --context "$ctx" || true
    done

    log_success "Roles: localhost-tunnel=${tunnel_node}, redis=${redis_node}, controller=${controller_node}, workers=$(printf "%s " "${workers[@]:3}")"
}

show_local_node_roles() {
    echo
    log_success "🏗️ Node Role Assignment:"
    echo "========================"
    printf "%-30s | %-15s | %s\n" "NODE NAME" "QUADRATIC ROLE" "STATUS"
    echo "-------------------------------|-----------------|--------"
    
    kubectl get nodes --context "kind-${CLUSTER_NAME}" -o json | \
    jq -r '.items[] | "\(.metadata.name)|\(.metadata.labels."quadratic.io/node-role" // "none")|\(.status.conditions[] | select(.type=="Ready") | .status)"' | \
    while IFS='|' read -r name role status; do
        printf "%-30s | %-15s | %s\n" "$name" "$role" "$status"
    done
    echo "========================"
    echo
}

#------------------------------------------------------------------------------
# Verification Functions
#------------------------------------------------------------------------------
verify_setup() {
    log_step "Verifying setup..."
    
    # Check cluster health
    log_info "Checking cluster health..."
    kubectl cluster-info --context "kind-${CLUSTER_NAME}"
    
    # Check nodes
    log_info "Checking nodes..."
    kubectl get nodes --context "kind-${CLUSTER_NAME}"
    show_local_node_roles
    
    # Check registry connectivity from host
    log_info "Testing registry connectivity from host..."
    if ! curl -s "http://localhost:${REGISTRY_PORT}/v2/_catalog" &> /dev/null; then
        log_error "Registry is not accessible from host"
        exit 1
    fi

    
    log_success "Setup verification completed"
}

#------------------------------------------------------------------------------
# Information Display Functions
#------------------------------------------------------------------------------
show_setup_info() {
    echo
    log_success "🎉 Quadratic Cloud local environment is ready!"
    echo
    log_info "📋 Environment Information:"
    echo "  • Cluster Name: ${CLUSTER_NAME}"
    echo "  • Context: kind-${CLUSTER_NAME}"
    echo "  • Registry: localhost:${REGISTRY_PORT}"
    echo "  • Worker Nodes: ${WORKER_NODES}"
    echo "  • Control Plane: $(kubectl get nodes --context "kind-${CLUSTER_NAME}" -o name | grep control-plane | cut -d/ -f2)"
    echo
    log_info "🔗 Useful Commands:"
    echo "  • Switch context: kubectl config use-context kind-${CLUSTER_NAME}"
    echo "  • Get nodes: kubectl get nodes"
    echo "  • Registry catalog: curl http://localhost:${REGISTRY_PORT}/v2/_catalog"
    echo "  • Delete cluster: kind delete cluster --name ${CLUSTER_NAME}"
    echo
    log_info "📁 Next Steps:"
    echo "  1. Build images: ./infra/k8s/scripts/build.sh"
    echo "  2. Deploy system: ./infra/k8s/scripts/deploy.sh"
    echo "  3. Set up localhost tunnel: ./infra/k8s/scripts/tunnel.sh"
    echo "  4. Set up localhost port forwarding: ./infra/k8s/scripts/port-forward.sh"
    echo "  5. Test system: ./infra/k8s/scripts/test.sh"
    echo "  6. Watch logs: ./infra/k8s/scripts/logs.sh"
    echo
}

#------------------------------------------------------------------------------
# Cleanup on Error
#------------------------------------------------------------------------------
cleanup_on_error() {
    local exit_code=$?
    log_error "Setup failed with exit code $exit_code"
    
    # Cleanup cluster if it was partially created
    if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        log_info "Cleaning up partially created cluster..."
        kind delete cluster --name "${CLUSTER_NAME}" || true
    fi
    
    exit $exit_code
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    echo -e "${BLUE}🚀 Setting up Quadratic Cloud Local Development Environment${NC}"
    echo
    
    # Parse command line arguments
    parse_args "$@"
    
    # Set up error handling
    trap cleanup_on_error ERR
    
    # Execute setup steps
    check_prerequisites
    setup_local_registry
    create_kind_cluster
    configure_local_node_roles
    verify_setup
    show_setup_info
    
    log_success "Setup completed successfully!"
}

# Run main function with all arguments
main "$@"
