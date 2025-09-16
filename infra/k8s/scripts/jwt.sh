#!/bin/bash

#==============================================================================
# Quadratic Cloud - JWT Key Generation Script
#==============================================================================
# This script generates RSA private keys and JWKS JSON for JWT authentication.
# It can be run standalone or sourced by other scripts.
#
# Usage: 
#   ./jwt.sh                    - Interactive mode
#   ./jwt.sh generate           - Generate keys
#   ./jwt.sh help               - Show help
#
# Requirements:
#   - openssl
#   - node.js (for JWKS generation)
#   - jq (for JSON formatting)
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
readonly K8S_DIR="${PROJECT_ROOT}/infra/k8s"

# Colors (only define if not already defined)
if [[ -z "${RED:-}" ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly BLUE='\033[0;34m'
    readonly YELLOW='\033[1;33m'
    readonly PURPLE='\033[0;35m'
    readonly CYAN='\033[0;36m'
    readonly NC='\033[0m'
fi

#------------------------------------------------------------------------------
# Utility Functions
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

#------------------------------------------------------------------------------
# Prerequisite Checks
#------------------------------------------------------------------------------
check_prerequisites() {
    local missing_tools=()
    
    # Check required tools
    if ! command -v openssl &> /dev/null; then
        missing_tools+=("openssl")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("node.js")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools:"
        printf "  • %s\n" "${missing_tools[@]}"
        echo
        log_info "Install missing tools:"
        echo "  • Ubuntu/Debian: sudo apt-get install openssl nodejs jq"
        echo "  • macOS: brew install openssl node jq"
        echo "  • CentOS/RHEL: sudo yum install openssl nodejs npm jq"
        return 1
    fi
    
    return 0
}

#------------------------------------------------------------------------------
# JWT Key Generation Function
#------------------------------------------------------------------------------
generate_jwt_keys() {
    log_step "Generating JWT Keys..."
    echo
    
    # Check prerequisites
    if ! check_prerequisites; then
        return 1
    fi
    
    log_info "⏳ Generating RSA key pair (2048-bit)..."
    
    # Generate RSA private key (2048-bit)
    local private_key
    if ! private_key=$(openssl genrsa 2048 2>/dev/null); then
        log_error "Failed to generate RSA private key"
        return 1
    fi
    
    # Ensure traditional RSA format
    private_key=$(echo "$private_key" | openssl rsa -traditional 2>/dev/null)
    
    # Validate the key format
    if [[ ! "$private_key" =~ "BEGIN RSA PRIVATE KEY" ]]; then
        log_error "Generated key is not in traditional RSA format"
        return 1
    fi
    
    # Generate public key for verification
    local public_key
    if ! public_key=$(echo "$private_key" | openssl rsa -pubout 2>/dev/null); then
        log_error "Failed to extract public key"
        return 1
    fi
    
    # Generate key ID with timestamp for uniqueness
    local key_id="quadratic-$(date +%Y%m%d%H%M%S)"
    
    log_info "⏳ Generating JWKS JSON..."
    
    # Create temporary Node.js script to generate JWKS
    local temp_script
    temp_script=$(mktemp)
    trap "rm -f '$temp_script'" EXIT
    
    cat > "$temp_script" << 'EOF'
const crypto = require('crypto');

// Read private key from stdin
let privateKeyPem = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
    privateKeyPem += chunk;
});

process.stdin.on('end', () => {
    try {
        // Parse the private key
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        
        // Create public key object
        const publicKeyObj = crypto.createPublicKey(privateKey);
        
        // Export as JWK
        const jwk = publicKeyObj.export({ format: 'jwk' });
        
        // Get key ID from environment
        const keyId = `key-${Date.now()}`;
        
        // Create JWKS structure
        const jwks = {
            keys: [{
                kty: 'RSA',
                use: 'sig',
                kid: keyId,
                n: jwk.n,
                e: jwk.e,
                alg: 'RS256'
            }]
        };
        
        // Output the JWKS as formatted JSON
        console.log(JSON.stringify(jwks, null, 2));
        
    } catch (error) {
        console.error('Error generating JWKS:', error.message);
        process.exit(1);
    }
});
EOF
    
    # Generate JWKS using Node.js
    local jwks
    if ! jwks=$(echo "$private_key" | KEY_ID="$key_id" node "$temp_script" 2>/dev/null); then
        log_error "Failed to generate JWKS JSON"
        rm -f "$temp_script"
        return 1
    fi
    
    # Validation: Ensure JWKS is valid JSON
    if ! echo "$jwks" | jq -e '.keys[0].n' >/dev/null 2>&1; then
        log_error "Generated JWKS is not valid JSON"
        return 1
    fi
    
    # Clean up temp script
    rm -f "$temp_script"
    
    # Display the results
    display_generated_keys "$private_key" "$jwks" "$key_id"
    
    return 0
}

#------------------------------------------------------------------------------
# Display Generated Keys
#------------------------------------------------------------------------------
display_generated_keys() {
    local private_key="$1"
    local jwks="$2"
    local key_id="$3"
    
    log_success "JWT Keys Generated Successfully!"
    echo
    echo -e "${CYAN}📋 Copy and paste the following into your .env file:${NC}"
    echo
    echo -e "${YELLOW}#===============================================================================${NC}"
    echo -e "${YELLOW}# JWT Configuration - Generated $(date)${NC}"
    echo -e "${YELLOW}# Key ID: $key_id${NC}"
    echo -e "${YELLOW}#===============================================================================${NC}"
    echo
    
    # Output the private key (escape newlines for .env format)
    echo -e "${PURPLE}# JWT Private Key (RSA 2048-bit) - Used by controller for signing${NC}"
    echo -n "JWT_ENCODING_KEY="
    echo "$private_key" | sed ':a;N;$!ba;s/\n/\\n/g'
    echo
    echo
    
    # Output the JWKS (compact format for .env)
    echo -e "${PURPLE}# JWKS JSON - Served at controller's /.well-known/jwks.json endpoint${NC}"
    echo -n "JWKS="
    echo "$jwks" | jq -c .
    echo
    echo
    echo -e "${YELLOW}#===============================================================================${NC}"
    echo
    
    # Instructions
    echo -e "${GREEN}📝 Setup Instructions:${NC}"
    echo "1. Copy the above JWT_ENCODING_KEY and JWKS lines"
    echo "2. Paste them into your ${K8S_DIR}/.env file"
    echo "3. Run deployment: ./infra/k8s/scripts/deploy.sh"
    echo "4. The controller will serve JWKS at http://localhost:3004/.well-known/jwks.json"
    echo
    
    # Technical details
    echo -e "${CYAN}🔍 Key Information:${NC}"
    echo "• Key ID: $key_id"
    echo "• Algorithm: RS256 (RSA with SHA-256)"
    echo "• Key Size: 2048 bits"
    echo "• Generated: $(date)"
    echo "• Use Case: Worker JWT authentication"
    echo
    
    # Security notes
    echo -e "${YELLOW}🔒 Security Notes:${NC}"
    echo "• Keep the private key (JWT_ENCODING_KEY) secure"
    echo "• The JWKS JSON contains only the public key components"
    echo "• Workers will get JWTs signed with the private key"
    echo "• Other services will validate JWTs using the public key from /.well-known/jwks.json"
    echo
    
    # Verification
    local key_count
    key_count=$(echo "$jwks" | jq -r '.keys | length')
    log_success "Generated JWKS with $key_count RSA key(s)"
}

#------------------------------------------------------------------------------
# Interactive Menu
#------------------------------------------------------------------------------
show_jwt_menu() {
    echo -e "${PURPLE}🔐 JWT Key Generation${NC}"
    echo
    echo -e "${GREEN}Available Actions:${NC}"
    echo "  1. generate   - Generate new JWT keys"
    echo "  2. verify     - Verify .env file has valid JWT keys"
    echo "  3. info       - Show information about JWT setup"
    echo "  4. help       - Show detailed help"
    echo "  0. exit       - Exit"
    echo
}

verify_env_jwt_keys() {
    log_step "Verifying JWT keys in .env file..."
    
    local env_file="${K8S_DIR}/.env"
    
    if [ ! -f "$env_file" ]; then
        log_error ".env file not found at $env_file"
        return 1
    fi
    
    # Check for JWT_ENCODING_KEY
    if ! grep -q "^JWT_ENCODING_KEY=" "$env_file"; then
        log_error "JWT_ENCODING_KEY not found in .env file"
        return 1
    fi
    
    # Check for JWKS
    if ! grep -q "^JWKS=" "$env_file"; then
        log_error "JWKS not found in .env file"
        return 1
    fi
    
    # Extract and validate private key format
    local private_key_line
    private_key_line=$(grep "^JWT_ENCODING_KEY=" "$env_file" | cut -d'=' -f2-)
    
    if [[ ! "$private_key_line" =~ "BEGIN RSA PRIVATE KEY" ]]; then
        log_error "JWT_ENCODING_KEY does not appear to be a valid RSA private key"
        return 1
    fi
    
    # Extract and validate JWKS JSON format
    local jwks_line
    jwks_line=$(grep "^JWKS=" "$env_file" | cut -d'=' -f2-)
    
    if ! echo "$jwks_line" | jq -e '.keys[0].n' >/dev/null 2>&1; then
        log_error "JWKS is not valid JSON or missing required fields"
        return 1
    fi
    
    log_success "JWT keys in .env file are valid"
    
    # Show key information
    local key_id
    key_id=$(echo "$jwks_line" | jq -r '.keys[0].kid // "unknown"')
    
    echo
    echo -e "${CYAN}🔍 Found JWT Configuration:${NC}"
    echo "• Key ID: $key_id"
    echo "• Private Key: Present ✓"
    echo "• JWKS JSON: Valid ✓"
    echo "• Location: $env_file"
    
    return 0
}

show_jwt_info() {
    echo -e "${BLUE}📖 JWT Authentication Overview${NC}"
    echo
    echo -e "${PURPLE}How it works:${NC}"
    echo "1. Controller uses JWT_ENCODING_KEY (private) to sign worker JWTs"
    echo "2. Controller serves JWKS (public) at /.well-known/jwks.json endpoint"
    echo "3. Workers get signed JWTs from controller for Worker authentication"
    echo "4. Other services validates worker JWTs using public keys from controller's /.well-known/jwks.json"
    echo
    echo -e "${PURPLE}Required Environment Variables:${NC}"
    echo "• JWT_ENCODING_KEY - RSA private key (PEM format, 2048-bit)"
    echo "• JWKS - JSON Web Key Set with public key components"
    echo
    echo -e "${PURPLE}Endpoints:${NC}"
    echo "• http://controller:3004/.well-known/jwks.json - JWKS endpoint"
    echo
}

show_jwt_help() {
    echo -e "${BLUE}📖 JWT Key Generation Help${NC}"
    echo
    echo -e "${PURPLE}Usage:${NC}"
    echo "  ./jwt.sh                  - Interactive mode"
    echo "  ./jwt.sh generate         - Generate new keys"
    echo "  ./jwt.sh verify           - Verify existing keys"
    echo "  ./jwt.sh info             - Show information"
    echo "  ./jwt.sh help             - Show this help"
    echo
    echo -e "${PURPLE}Prerequisites:${NC}"
    echo "• openssl - RSA key generation"
    echo "• node.js - JWKS generation"
    echo "• jq - JSON processing"
    echo
    echo -e "${PURPLE}Generated Files:${NC}"
    echo "• Keys are output to stdout for copying into .env file"
    echo "• No temporary files are left behind"
    echo "• Each generation creates a unique key ID with timestamp"
    echo
    echo -e "${PURPLE}Security:${NC}"
    echo "• Uses RSA-2048 keys (industry standard)"
    echo "• Keys are generated locally (never transmitted)"
    echo "• Private key stays on controller, public key shared via JWKS"
    echo
}

interactive_jwt_mode() {
    while true; do
        show_jwt_menu
        
        echo -n "Enter choice [0-4]: "
        read -r choice
        echo
        
        case $choice in
            1) generate_jwt_keys ;;
            2) verify_env_jwt_keys ;;
            3) show_jwt_info ;;
            4) show_jwt_help ;;
            0) 
                log_info "Exiting JWT key generation"
                exit 0
                ;;
            *)
                log_error "Invalid choice. Please try again."
                ;;
        esac
        
        echo
        echo -e "${YELLOW}Press Enter to continue...${NC}"
        read -r
    done
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    # Change to project root for consistent paths
    cd "$PROJECT_ROOT"
    
    # Handle command line arguments
    case "${1:-}" in
        "generate")
            generate_jwt_keys
            ;;
        "verify")
            verify_env_jwt_keys
            ;;
        "info")
            show_jwt_info
            ;;
        "help")
            show_jwt_help
            ;;
        "")
            # Interactive mode
            interactive_jwt_mode
            ;;
        *)
            log_error "Unknown command: $1"
            echo
            show_jwt_help
            exit 1
            ;;
    esac
}

# Only run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi