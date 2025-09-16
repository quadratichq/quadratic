#!/bin/bash

#==============================================================================
# Quadratic Cloud - Main Launcher Script
#==============================================================================
# This is the main entry point for all Quadratic Cloud operations.
# It provides a menu-driven interface for all available scripts.
#
# Usage: ./infra/k8s/scripts/main.sh [COMMAND]
# Commands: setup, build, deploy, tunnel, all, status, test, logs, port-forward, dev, shell, restart, jwt, cleanup, reset, help
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

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
# Display Functions
#------------------------------------------------------------------------------
show_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
   ____                  _           _   _      
  / __ \                | |         | | (_)     
 | |  | |_   _  __ _  __| |_ __ __ _| |_ _  ___ 
 | |  | | | | |/ _` |/ _` | '__/ _` | __| |/ __|
 | |__| | |_| | (_| | (_| | | | (_| | |_| | (__ 
  \___\_\\__,_|\__,_|\__,_|_|  \__,_|\__|_|\___|
                                               
   ______ _                 _                  
  / ___| | |               | |                 
 | |   | | | ___  _   _  __| |                 
 | |   | | |/ _ \| | | |/ _` |                 
 | |___| | | (_) | |_| | (_| |                 
  \____|_|_|\___/ \__,_|\__,_|                 
                                               
EOF
    echo -e "${NC}"
    echo -e "${CYAN}🚀 Kubernetes Development Environment${NC}"
    echo -e "${CYAN}Version 1.0.0${NC}"
    echo
}

show_menu() {
    echo -e "${PURPLE}📋 Available Commands:${NC}"
    echo
    echo -e "${GREEN}🏗️  Setup & Deploy:${NC}"
    echo "  1. setup        - Create local Kubernetes environment"
    echo "  2. build        - Build Docker images"
    echo "  3. deploy       - Deploy to Kubernetes"
    echo "  4. tunnel       - Set up tunnel to local services"
    echo "  5. port-forward - Port forward services"
    echo "  6. all          - Run setup + build + deploy"
    echo
    echo -e "${GREEN}🔍 Monitor & Test:${NC}"
    echo "  7. status       - Show system status"
    echo "  8. test         - Run system tests"
    echo "  9. logs         - View component logs"
    echo
    echo -e "${GREEN}🛠️  Development:${NC}"
    echo " 10. dev          - Development helpers"
    echo " 11. shell        - Open shell in controller"
    echo " 12. restart      - Restart all pods"
    echo
    echo -e "${GREEN}🔐 Security:${NC}"
    echo " 13. jwt          - Generate JWT keys for .env"
    echo
    echo -e "${GREEN}🧹 Cleanup:${NC}"
    echo " 14. cleanup      - Cleanup resources"
    echo " 15. reset        - Complete reset"
    echo
    echo " 16. help         - Show detailed help"
    echo "  0. exit         - Exit"
    echo
}

#------------------------------------------------------------------------------
# Command Functions
#------------------------------------------------------------------------------
run_setup() {
    echo -e "${BLUE}🏗️  Setting up local environment...${NC}"
    "${SCRIPT_DIR}/setup.sh"
}

run_build() {
    echo -e "${BLUE}🔨 Building Docker images...${NC}"
    "${SCRIPT_DIR}/build.sh"
}

run_deploy() {
    echo -e "${BLUE}🚀 Deploying to Kubernetes...${NC}"
    "${SCRIPT_DIR}/deploy.sh"
}

run_tunnel() {
    echo -e "${BLUE}🔗 Setting up tunnel...${NC}"
    "${SCRIPT_DIR}/tunnel.sh"
}

run_port_forward() {
    echo -e "${BLUE}🔗 Setting up port forwarding...${NC}"
    "${SCRIPT_DIR}/port-forward.sh" start
}

run_all() {
    echo -e "${BLUE}🎯 Running complete setup...${NC}"
    run_setup
    run_build
    run_deploy
    run_tunnel
    run_port_forward
    echo -e "${GREEN}✅ Complete setup finished!${NC}"
}

run_status() {
    echo -e "${BLUE}📊 Checking system status...${NC}"
    "${SCRIPT_DIR}/status.sh"
}

run_test() {
    echo -e "${BLUE}🧪 Running system tests...${NC}"
    "${SCRIPT_DIR}/test.sh"
}

run_logs() {
    echo -e "${BLUE}📋 Showing logs...${NC}"
    "${SCRIPT_DIR}/logs.sh"
}

run_dev() {
    echo -e "${BLUE}🛠️  Development mode...${NC}"
    "${SCRIPT_DIR}/dev.sh"
}

run_shell() {
    echo -e "${BLUE}🐚 Opening controller shell...${NC}"
    "${SCRIPT_DIR}/dev.sh" shell
}

run_restart() {
    echo -e "${BLUE}🔄 Restarting pods...${NC}"
    "${SCRIPT_DIR}/dev.sh" restart
}

run_jwt() {
    echo -e "${BLUE}🔐 JWT Key Generation...${NC}"
    "${SCRIPT_DIR}/jwt.sh" generate
}

run_cleanup() {
    echo -e "${BLUE}🧹 Cleaning up...${NC}"
    "${SCRIPT_DIR}/cleanup.sh"
}

run_reset() {
    echo -e "${BLUE}🔄 Complete reset...${NC}"
    "${SCRIPT_DIR}/cleanup.sh" all
    echo -e "${YELLOW}⏳ Waiting 5 seconds before setup...${NC}"
    sleep 5
    run_all
}

show_detailed_help() {
    echo -e "${BLUE}📖 Detailed Help${NC}"
    echo
    echo -e "${PURPLE}Script Descriptions:${NC}"
    echo
    echo "• setup.sh        - Creates kind cluster with local registry"
    echo "• build.sh        - Builds controller and worker Docker images"
    echo "• deploy.sh       - Deploys all Kubernetes manifests"
    echo "• tunnel.sh       - Sets up tunnel to local services"
    echo "• port-forward.sh - Port forward services"
    echo "• test.sh         - Runs comprehensive system tests"
    echo "• logs.sh         - Shows logs with filtering options"
    echo "• status.sh       - Displays system status and health"
    echo "• cleanup.sh      - Removes resources (various levels)"
    echo "• dev.sh          - Development helpers and shortcuts"
    echo "• jwt.sh          - Generates JWT keys for worker authentication"
    echo
    echo -e "${PURPLE}JWT Authentication Setup:${NC}"
    echo
    echo "1. Generate JWT keys:"
    echo "   ./main.sh jwt   (or ./main.sh 13)"
    echo
    echo "2. Copy generated keys to infra/k8s/.env file"
    echo
    echo "3. Deploy with JWT authentication:"
    echo "   ./main.sh deploy"
    echo
    echo -e "${PURPLE}Common Workflows:${NC}"
    echo
    echo "1. First-time setup with JWT and services:"
    echo "   ./main.sh setup && ./main.sh jwt && [edit .env] && ./main.sh build && ./main.sh deploy && ./main.sh tunnel && ./main.sh port-forward"
    echo
    echo "2. After code changes:"
    echo "   ./main.sh build && ./main.sh deploy"
    echo
    echo "3. Check everything is running:"
    echo "   ./main.sh status"
    echo
    echo "4. View all logs:"
    echo "   ./main.sh logs"
    echo
    echo "5. Restart services:"
    echo "   ./main.sh restart"
    echo
    echo -e "${PURPLE}JWT Configuration:${NC}"
    echo
    echo "• Keys are generated using RSA-2048 algorithm"
    echo "• Private key stays on controller for JWT signing"
    echo "• Public key is served via controller's /jwks endpoint"
    echo "• Workers get signed JWTs for API authentication"
    echo "• API validates worker JWTs using controller's public keys"
    echo
}

#------------------------------------------------------------------------------
# Interactive Mode
#------------------------------------------------------------------------------
interactive_mode() {
    while true; do
        show_banner
        show_menu
        
        echo -n "Enter choice [0-16]: "
        read -r choice
        echo
        
        case $choice in
            1) run_setup ;;
            2) run_build ;;
            3) run_deploy ;;
            4) run_tunnel ;;
            5) run_port_forward ;;
            6) run_all ;;
            7) run_status ;;
            8) run_test ;;
            9) run_logs ;;
            10) run_dev ;;
            11) run_shell ;;
            12) run_restart ;;
            13) run_jwt ;;
            14) run_cleanup ;;
            15) run_reset ;;
            16) show_detailed_help ;;
            0) 
                echo -e "${GREEN}👋 Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Invalid choice. Please try again.${NC}"
                ;;
        esac
        
        echo
        echo -e "${YELLOW}Press Enter to continue...${NC}"
        read -r
    done
}

#------------------------------------------------------------------------------
# Command Line Mode
#------------------------------------------------------------------------------
command_line_mode() {
    local command="$1"
    
    case "$command" in
        "setup") run_setup ;;
        "build") run_build ;;
        "deploy") run_deploy ;;
        "tunnel") run_tunnel ;;
        "port-forward") run_port_forward ;;
        "all") run_all ;;
        "status") run_status ;;
        "test") run_test ;;
        "logs") run_logs ;;
        "dev") run_dev ;;
        "shell") run_shell ;;
        "restart") run_restart ;;
        "jwt") run_jwt ;;
        "cleanup") run_cleanup ;;
        "reset") run_reset ;;
        "help") show_detailed_help ;;
        *)
            echo -e "${RED}❌ Unknown command: $command${NC}"
            echo
            show_detailed_help
            exit 1
            ;;
    esac
}

#------------------------------------------------------------------------------
# Main Function
#------------------------------------------------------------------------------
main() {
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Make all scripts executable
    chmod +x "${SCRIPT_DIR}"/*.sh
    
    # Check if command provided
    if [ $# -eq 0 ]; then
        # Interactive mode
        interactive_mode
    else
        # Command line mode
        command_line_mode "$1"
    fi
}

# Run main function
main "$@"
