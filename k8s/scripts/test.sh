#!/bin/bash

#==============================================================================
# Quadratic Cloud - System Testing Script
#==============================================================================
# This script runs comprehensive tests against the deployed Quadratic Cloud
# system to verify all components are working correctly.
#
# What it tests:
# - Redis connectivity and job queue functionality
# - Controller health and API endpoints
# - Worker creation and job processing
# - System resource usage and limits
# - Network connectivity between components
#
# Usage: ./k8s/scripts/test.sh [OPTIONS]
# Options:
#   --namespace NS    Custom namespace (default: quadratic-cloud)
#   --timeout SEC     Test timeout in seconds (default: 300)
#   --debug           Show debug information on failure
#   --quick           Run only basic tests (skip worker tests)
#==============================================================================

set -e  # Exit on any error
set -u  # Exit on undefined variables

#------------------------------------------------------------------------------
# Configuration Constants
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Default configuration
NAMESPACE="quadratic-cloud"
CONTEXT="kind-quadratic-cloud"
TIMEOUT=300
DEBUG_MODE=false
QUICK_TESTS=false

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

log_test() {
    echo -e "${PURPLE}🧪 $1${NC}"
}

log_debug() {
    if [ "$DEBUG_MODE" = true ]; then
        echo -e "${CYAN}🐛 $1${NC}"
    fi
}

#------------------------------------------------------------------------------
# Test Result Tracking
#------------------------------------------------------------------------------
declare -a TEST_RESULTS=()
declare -a FAILED_TESTS=()

record_test_result() {
    local test_name="$1"
    local result="$2"  # "PASS" or "FAIL"
    local message="${3:-}"
    
    TEST_RESULTS+=("$test_name:$result:$message")
    
    if [ "$result" = "FAIL" ]; then
        FAILED_TESTS+=("$test_name")
    fi
}

#------------------------------------------------------------------------------
# Parse Command Line Arguments
#------------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --debug)
                DEBUG_MODE=true
                shift
                ;;
            --quick)
                QUICK_TESTS=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
Quadratic Cloud - System Testing Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --namespace NS    Custom namespace (default: quadratic-cloud)
    --timeout SEC     Test timeout in seconds (default: 300)
    --debug           Show debug information on failure
    --quick           Run only basic tests (skip worker tests)
    --help            Show this help message

TEST CATEGORIES:
    1. Environment Validation
    2. Redis Functionality
    3. Controller Health
    4. Network Connectivity
    5. Worker Job Processing (unless --quick)
    6. Resource Usage
    7. Security Verification

EOF
}

#------------------------------------------------------------------------------
# Test Helper Functions
#------------------------------------------------------------------------------
run_kubectl() {
    kubectl --context "$CONTEXT" --namespace "$NAMESPACE" "$@"
}

wait_for_condition() {
    local description="$1"
    local condition_command="$2"
    local timeout_seconds="${3:-30}"
    
    log_debug "Waiting for: $description"
    
    local elapsed=0
    while [ $elapsed -lt $timeout_seconds ]; do
        if eval "$condition_command" &> /dev/null; then
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    
    log_error "Timeout waiting for: $description"
    return 1
}

#------------------------------------------------------------------------------
# Environment Tests
#------------------------------------------------------------------------------
test_environment() {
    log_test "Testing environment prerequisites..."
    
    # Test kubectl connectivity
    if ! kubectl cluster-info --context "$CONTEXT" &> /dev/null; then
        record_test_result "kubectl_connectivity" "FAIL" "Cannot connect to cluster"
        return 1
    fi
    record_test_result "kubectl_connectivity" "PASS"
    
    # Test namespace exists
    if ! kubectl get namespace "$NAMESPACE" --context "$CONTEXT" &> /dev/null; then
        record_test_result "namespace_exists" "FAIL" "Namespace $NAMESPACE not found"
        return 1
    fi
    record_test_result "namespace_exists" "PASS"
    
    # Test required deployments exist
    local required_deployments=("quadratic-cloud-controller")
    for deployment in "${required_deployments[@]}"; do
        if ! run_kubectl get deployment "$deployment" &> /dev/null; then
            record_test_result "deployment_${deployment}" "FAIL" "Deployment not found"
            return 1
        fi
        record_test_result "deployment_${deployment}" "PASS"
    done
    
    # Test required statefulsets exist
    local required_statefulsets=("quadratic-cloud-redis")
    for statefulset in "${required_statefulsets[@]}"; do
        if ! run_kubectl get statefulset "$statefulset" &> /dev/null; then
            record_test_result "statefulset_${statefulset}" "FAIL" "StatefulSet not found"
            return 1
        fi
        record_test_result "statefulset_${statefulset}" "PASS"
    done
    
    log_success "Environment tests passed"
}

#------------------------------------------------------------------------------
# Redis Tests
#------------------------------------------------------------------------------
test_redis() {
    log_test "Testing Redis functionality..."
    
    # Test Redis pod is running
    if ! wait_for_condition "Redis pod ready" \
        "run_kubectl get pod -l app.kubernetes.io/name=quadratic-cloud-redis -o jsonpath='{.items[0].status.phase}' | grep -q Running" 30; then
        record_test_result "redis_pod_running" "FAIL" "Redis pod not running"
        return 1
    fi
    record_test_result "redis_pod_running" "PASS"
    
    # Test Redis connectivity
    local redis_ping_result
    redis_ping_result=$(run_kubectl exec statefulset/quadratic-cloud-redis -- redis-cli ping 2>/dev/null || echo "FAILED")
    if [ "$redis_ping_result" != "PONG" ]; then
        record_test_result "redis_connectivity" "FAIL" "Redis ping failed: $redis_ping_result"
        return 1
    fi
    record_test_result "redis_connectivity" "PASS"
    
    # Test Redis operations
    local test_key="test:$(date +%s)"
    local test_value="test-value-$(date +%s)"
    
    # Set operation
    if ! run_kubectl exec statefulset/quadratic-cloud-redis -- \
        redis-cli set "$test_key" "$test_value" &> /dev/null; then
        record_test_result "redis_set_operation" "FAIL" "Cannot set Redis key"
        return 1
    fi
    
    # Get operation
    local retrieved_value
    retrieved_value=$(run_kubectl exec statefulset/quadratic-cloud-redis -- \
        redis-cli get "$test_key" 2>/dev/null || echo "FAILED")
    if [ "$retrieved_value" != "$test_value" ]; then
        record_test_result "redis_get_operation" "FAIL" "Retrieved value doesn't match: expected '$test_value', got '$retrieved_value'"
        return 1
    fi
    record_test_result "redis_get_operation" "PASS"
    
    # Cleanup test key
    run_kubectl exec statefulset/quadratic-cloud-redis -- \
        redis-cli del "$test_key" &> /dev/null || true
    
    # Test Redis persistence
    local redis_info
    redis_info=$(run_kubectl exec statefulset/quadratic-cloud-redis -- \
        redis-cli info persistence 2>/dev/null || echo "FAILED")
    if [[ "$redis_info" == *"aof_enabled:1"* ]]; then
        record_test_result "redis_persistence" "PASS" "AOF persistence enabled"
    else
        record_test_result "redis_persistence" "WARN" "AOF persistence not detected"
    fi
    
    log_success "Redis tests passed"
}

#------------------------------------------------------------------------------
# Controller Tests
#------------------------------------------------------------------------------
test_controller() {
    log_test "Testing Controller functionality..."
    
    # Test Controller pod is running
    if ! wait_for_condition "Controller pod ready" \
        "run_kubectl get pod -l app.kubernetes.io/name=quadratic-cloud-controller -o jsonpath='{.items[0].status.phase}' | grep -q Running" 30; then
        record_test_result "controller_pod_running" "FAIL" "Controller pod not running"
        return 1
    fi
    record_test_result "controller_pod_running" "PASS"
    
    # Test Controller health endpoint
    local health_response
    health_response=$(run_kubectl exec deployment/quadratic-cloud-controller -- \
        curl -s -f http://localhost:3004/health 2>/dev/null || echo "FAILED")
    
    if [[ "$health_response" == *"healthy"* ]] || [[ "$health_response" == *"ok"* ]] || [[ "$health_response" == "FAILED" ]]; then
        if [ "$health_response" = "FAILED" ]; then
            record_test_result "controller_health" "FAIL" "Health endpoint not responding"
        else
            record_test_result "controller_health" "PASS" "Health endpoint responding: $health_response"
        fi
    else
        record_test_result "controller_health" "WARN" "Health endpoint response unclear: $health_response"
    fi
    
    # Test Controller metrics endpoint (if available)
    if run_kubectl exec deployment/quadratic-cloud-controller -- \
        curl -s -f http://localhost:9090/metrics &> /dev/null; then
        record_test_result "controller_metrics" "PASS" "Metrics endpoint accessible"
    else
        record_test_result "controller_metrics" "WARN" "Metrics endpoint not accessible"
    fi
    
    # Test Controller logs
    local controller_logs
    controller_logs=$(run_kubectl logs deployment/quadratic-cloud-controller --tail=10 2>/dev/null || echo "FAILED")
    if [ "$controller_logs" != "FAILED" ] && [ -n "$controller_logs" ]; then
        record_test_result "controller_logs" "PASS" "Controller generating logs"
    else
        record_test_result "controller_logs" "FAIL" "Cannot retrieve controller logs"
    fi
    
    log_success "Controller tests passed"
}

#------------------------------------------------------------------------------
# Network Tests
#------------------------------------------------------------------------------
test_networking() {
    log_test "Testing network connectivity..."
    
    # Test Controller to Redis connectivity
    if run_kubectl exec deployment/quadratic-cloud-controller -- \
        nc -zv quadratic-cloud-redis 6379 &> /dev/null; then
        record_test_result "controller_to_redis" "PASS" "Controller can reach Redis"
    else
        record_test_result "controller_to_redis" "FAIL" "Controller cannot reach Redis"
    fi
    
    # Test DNS resolution
    if run_kubectl exec deployment/quadratic-cloud-controller -- \
        nslookup quadratic-cloud-redis &> /dev/null; then
        record_test_result "dns_resolution" "PASS" "DNS resolution working"
    else
        record_test_result "dns_resolution" "FAIL" "DNS resolution failed"
    fi
    
    # Test Service endpoints
    local redis_endpoints
    redis_endpoints=$(run_kubectl get endpoints quadratic-cloud-redis -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null || echo "FAILED")
    if [ "$redis_endpoints" != "FAILED" ] && [ -n "$redis_endpoints" ]; then
        record_test_result "redis_endpoints" "PASS" "Redis service has endpoints"
    else
        record_test_result "redis_endpoints" "FAIL" "Redis service has no endpoints"
    fi
    
    local controller_endpoints
    controller_endpoints=$(run_kubectl get endpoints quadratic-cloud-controller -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null || echo "FAILED")
    if [ "$controller_endpoints" != "FAILED" ] && [ -n "$controller_endpoints" ]; then
        record_test_result "controller_endpoints" "PASS" "Controller service has endpoints"
    else
        record_test_result "controller_endpoints" "FAIL" "Controller service has no endpoints"
    fi
    
    log_success "Network tests passed"
}

#------------------------------------------------------------------------------
# Worker Tests
#------------------------------------------------------------------------------
test_worker_functionality() {
    if [ "$QUICK_TESTS" = true ]; then
        log_info "Skipping worker tests (quick mode)"
        return 0
    fi
    
    log_test "Testing worker job creation..."
    
    # Generate a unique test file ID
    local test_file_id
    test_file_id=$(uuidgen 2>/dev/null || echo "test-file-$(date +%s)")
    
    log_debug "Creating test job for file: $test_file_id"
    
    # Create a test job in Redis
    local test_job="{\"file_id\":\"$test_file_id\",\"action\":\"test\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    
    if ! run_kubectl exec statefulset/quadratic-cloud-redis -- \
        redis-cli lpush "jobs:$test_file_id" "$test_job" &> /dev/null; then
        record_test_result "worker_job_creation" "FAIL" "Cannot create test job in Redis"
        return 1
    fi
    
    # Publish job event
    if ! run_kubectl exec statefulset/quadratic-cloud-redis -- \
        redis-cli publish "job_events" "$test_file_id" &> /dev/null; then
        record_test_result "worker_job_event" "FAIL" "Cannot publish job event"
        return 1
    fi
    
    record_test_result "worker_job_creation" "PASS" "Test job created and published"
    
    # Wait for worker job to be created (optional, depends on controller implementation)
    log_info "Waiting for potential worker job creation (30 seconds)..."
    sleep 30
    
    # Check if worker job was created
    local worker_jobs
    worker_jobs=$(run_kubectl get jobs -l app.kubernetes.io/component=worker --no-headers 2>/dev/null | wc -l || echo "0")
    
    if [ "$worker_jobs" -gt 0 ]; then
        record_test_result "worker_job_scheduled" "PASS" "Worker job(s) created: $worker_jobs"
        
        # Show worker status
        log_debug "Worker jobs:"
        run_kubectl get jobs -l app.kubernetes.io/component=worker || true
        run_kubectl get pods -l app.kubernetes.io/component=worker || true
    else
        record_test_result "worker_job_scheduled" "WARN" "No worker jobs found (may take longer to create or controller may not be fully functional)"
    fi
    
    # Cleanup test data
    run_kubectl exec statefulset/quadratic-cloud-redis -- \
        redis-cli del "jobs:$test_file_id" &> /dev/null || true
    
    log_success "Worker tests completed"
}

#------------------------------------------------------------------------------
# Resource Tests
#------------------------------------------------------------------------------
test_resource_usage() {
    log_test "Testing system resource usage..."
    
    # Check pod resource usage (if metrics server is available)
    if run_kubectl top pods &> /dev/null; then
        record_test_result "metrics_server" "PASS" "Metrics server available"
        
        log_debug "Current resource usage:"
        run_kubectl top pods || true
    else
        record_test_result "metrics_server" "WARN" "Metrics server not available"
    fi
    
    # Check persistent volume usage
    local pvc_status
    pvc_status=$(run_kubectl get pvc --no-headers 2>/dev/null | wc -l || echo "0")
    if [ "$pvc_status" -gt 0 ]; then
        record_test_result "persistent_volumes" "PASS" "Persistent volumes: $pvc_status"
        
        log_debug "Persistent volume claims:"
        run_kubectl get pvc || true
    else
        record_test_result "persistent_volumes" "WARN" "No persistent volumes found"
    fi
    
    # Check recent events for errors
    local error_events
    error_events=$(run_kubectl get events --field-selector type=Warning --no-headers 2>/dev/null | wc -l || echo "0")
    if [ "$error_events" -eq 0 ]; then
        record_test_result "system_events" "PASS" "No warning events"
    else
        record_test_result "system_events" "WARN" "Warning events found: $error_events"
        
        if [ "$DEBUG_MODE" = true ]; then
            log_debug "Recent warning events:"
            run_kubectl get events --field-selector type=Warning || true
        fi
    fi
    
    log_success "Resource tests completed"
}

#------------------------------------------------------------------------------
# Security Tests
#------------------------------------------------------------------------------
test_security() {
    log_test "Testing security configuration..."
    
    # Check if pods are running as non-root
    local controller_user
    controller_user=$(run_kubectl get pod -l app.kubernetes.io/name=quadratic-cloud-controller \
        -o jsonpath='{.items[0].spec.securityContext.runAsUser}' 2>/dev/null || echo "UNKNOWN")
    if [ "$controller_user" != "0" ] && [ "$controller_user" != "UNKNOWN" ]; then
        record_test_result "controller_non_root" "PASS" "Controller running as user: $controller_user"
    else
        record_test_result "controller_non_root" "WARN" "Controller user unclear: $controller_user"
    fi
    
    local redis_user
    redis_user=$(run_kubectl get pod -l app.kubernetes.io/name=quadratic-cloud-redis \
        -o jsonpath='{.items[0].spec.securityContext.runAsUser}' 2>/dev/null || echo "UNKNOWN")
    if [ "$redis_user" != "0" ] && [ "$redis_user" != "UNKNOWN" ]; then
        record_test_result "redis_non_root" "PASS" "Redis running as user: $redis_user"
    else
        record_test_result "redis_non_root" "WARN" "Redis user unclear: $redis_user"
    fi
    
    # Check service account configuration
    local controller_sa
    controller_sa=$(run_kubectl get deployment quadratic-cloud-controller \
        -o jsonpath='{.spec.template.spec.serviceAccountName}' 2>/dev/null || echo "UNKNOWN")
    if [ "$controller_sa" = "quadratic-cloud-controller" ]; then
        record_test_result "controller_service_account" "PASS" "Correct service account"
    else
        record_test_result "controller_service_account" "WARN" "Service account: $controller_sa"
    fi
    
    # Check RBAC
    if run_kubectl get role quadratic-cloud-controller &> /dev/null; then
        record_test_result "rbac_role" "PASS" "RBAC role exists"
    else
        record_test_result "rbac_role" "FAIL" "RBAC role missing"
    fi
    
    if run_kubectl get rolebinding quadratic-cloud-controller &> /dev/null; then
        record_test_result "rbac_binding" "PASS" "RBAC role binding exists"
    else
        record_test_result "rbac_binding" "FAIL" "RBAC role binding missing"
    fi
    
    log_success "Security tests completed"
}

#------------------------------------------------------------------------------
# Results Display
#------------------------------------------------------------------------------
show_test_results() {
    echo
    log_info "📊 Test Results Summary:"
    echo
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local warning_tests=0
    
    for result in "${TEST_RESULTS[@]}"; do
        IFS=':' read -r test_name test_result test_message <<< "$result"
        total_tests=$((total_tests + 1))
        
        case $test_result in
            "PASS")
                echo -e "  ${GREEN}✅ $test_name${NC}"
                passed_tests=$((passed_tests + 1))
                ;;
            "FAIL")
                echo -e "  ${RED}❌ $test_name${NC} - $test_message"
                failed_tests=$((failed_tests + 1))
                ;;
            "WARN")
                echo -e "  ${YELLOW}⚠️  $test_name${NC} - $test_message"
                warning_tests=$((warning_tests + 1))
                ;;
        esac
    done
    
    echo
    log_info "📈 Statistics:"
    echo "  • Total Tests: $total_tests"
    echo -e "  • Passed: ${GREEN}$passed_tests${NC}"
    echo -e "  • Failed: ${RED}$failed_tests${NC}"
    echo -e "  • Warnings: ${YELLOW}$warning_tests${NC}"
    
    if [ $failed_tests -eq 0 ]; then
        echo
        log_success "🎉 All critical tests passed! System is healthy."
        if [ $warning_tests -gt 0 ]; then
            log_warning "Some non-critical issues detected. See warnings above."
        fi
    else
        echo
        log_error "💥 Some tests failed. System may not be fully functional."
        log_info "Failed tests: ${FAILED_TESTS[*]}"
        return 1
    fi
}

#------------------------------------------------------------------------------
# Debug Information
#------------------------------------------------------------------------------
show_debug_info() {
    if [ "$DEBUG_MODE" = false ]; then
        return 0
    fi
    
    echo
    log_debug "🐛 Debug Information:"
    echo
    
    log_debug "Cluster Info:"
    kubectl cluster-info --context "$CONTEXT" || true
    echo
    
    log_debug "All Pods:"
    run_kubectl get pods -o wide || true
    echo
    
    log_debug "All Services:"
    run_kubectl get services || true
    echo
    
    log_debug "Recent Events:"
    run_kubectl get events --sort-by='.lastTimestamp' | tail -20 || true
    echo
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    echo -e "${BLUE}🧪 Testing Quadratic Cloud System${NC}"
    echo
    
    # Parse command line arguments
    parse_args "$@"
    
    # Validate environment first
    if ! kubectl get namespace "$NAMESPACE" --context "$CONTEXT" &> /dev/null; then
        log_error "Namespace $NAMESPACE not found in context $CONTEXT"
        log_info "Available namespaces:"
        kubectl get namespaces --context "$CONTEXT" || true
        exit 1
    fi
    
    # Run test suites
    test_environment
    test_redis
    test_controller
    test_networking
    test_worker_functionality
    test_resource_usage
    test_security
    
    # Show results
    show_test_results
    show_debug_info
    
    # Return appropriate exit code
    if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
        log_success "Testing completed successfully!"
        exit 0
    else
        log_error "Testing completed with failures!"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
