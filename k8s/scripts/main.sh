#!/bin/bash

#==============================================================================
# Quadratic Cloud - Main Launcher Script
#==============================================================================
# This is the main entry point for all Quadratic Cloud operations.
# It provides a menu-driven interface for all available scripts.
#
# Usage: ./k8s/scripts/main.sh [COMMAND]
# Commands: setup, build, deploy, test, logs, status, cleanup, dev
#==============================================================================

set -e
set -u

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

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
    echo "  1. setup      - Create local Kubernetes environment"
    echo "  2. build      - Build Docker images"
    echo "  3. deploy     - Deploy to Kubernetes"
    echo "  4. tunnel     - Set up tunnel to local services"
    echo "  5. all        - Run setup + build + deploy"
    echo
    echo -e "${GREEN}🔍 Monitor & Test:${NC}"
    echo "  6. status     - Show system status"
    echo "  7. test       - Run system tests"
    echo "  8. logs       - View component logs"
    echo "  9. port       - Port forward services"
    echo
    echo -e "${GREEN}🛠️  Development:${NC}"
    echo " 10. dev        - Development helpers"
    echo " 11. shell      - Open shell in controller"
    echo " 12. restart    - Restart all pods"
    echo
    echo -e "${GREEN}🧹 Cleanup:${NC}"
    echo " 13. cleanup    - Cleanup resources"
    echo " 14. reset      - Complete reset"
    echo
    echo " 15. help       - Show detailed help"
    echo "  0. exit       - Exit"
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

run_all() {
    echo -e "${BLUE}🎯 Running complete setup...${NC}"
    run_setup
    run_build
    run_deploy
    run_tunnel
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

run_port_forward() {
    echo -e "${BLUE}🔗 Setting up port forwarding...${NC}"
    "${SCRIPT_DIR}/port-forward.sh" all
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
    echo "• setup.sh    - Creates kind cluster with local registry"
    echo "• build.sh    - Builds controller and worker Docker images"
    echo "• deploy.sh   - Deploys all Kubernetes manifests"
    echo "• tunnel.sh   - Sets up tunnel to local services"
    echo "• test.sh     - Runs comprehensive system tests"
    echo "• logs.sh     - Shows logs with filtering options"
    echo "• status.sh   - Displays system status and health"
    echo "• cleanup.sh  - Removes resources (various levels)"
    echo "• dev.sh      - Development helpers and shortcuts"
    echo
    echo -e "${PURPLE}Common Workflows:${NC}"
    echo
    echo "1. First-time setup:"
    echo "   ./main.sh 1 && ./main.sh 2 && ./main.sh 3 && ./main.sh 4"
    echo
    echo "2. After code changes:"
    echo "   ./main.sh 2 && ./main.sh 3"
    echo
    echo "3. Quick restart:"
    echo "   ./main.sh 11"
    echo
    echo "4. Debug issues:"
    echo "   ./main.sh 5 && ./main.sh 7"
    echo
}

#------------------------------------------------------------------------------
# Interactive Mode
#------------------------------------------------------------------------------
interactive_mode() {
    while true; do
        show_banner
        show_menu
        
        echo -n "Enter choice [0-14]: "
        read -r choice
        echo
        
        case $choice in
            1) run_setup ;;
            2) run_build ;;
            3) run_deploy ;;
            4) run_tunnel ;;
            5) run_all ;;
            6) run_status ;;
            7) run_test ;;
            8) run_logs ;;
            9) run_port_forward ;;
            10) run_dev ;;
            11) run_shell ;;
            12) run_restart ;;
            13) run_cleanup ;;
            14) run_reset ;;
            15) show_detailed_help ;;
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
        "all") run_all ;;
        "status") run_status ;;
        "test") run_test ;;
        "logs") run_logs ;;
        "port") run_port_forward ;;
        "dev") run_dev ;;
        "shell") run_shell ;;
        "restart") run_restart ;;
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
