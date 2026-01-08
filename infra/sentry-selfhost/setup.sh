#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Update and install dependencies
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common unzip jq

# =============================================================================
# Install Docker
# =============================================================================

sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
sudo echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo chown ubuntu /var/run/docker.sock
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# =============================================================================
# Setup GCP Persistent Disk (optional)
# =============================================================================
# To persist Docker volumes on a GCP persistent disk, run:
#   ./gcp-persistent-disk.sh           # For new installs (before Sentry setup)
#   ./gcp-persistent-disk.sh --migrate # For existing installs (migrates data)
#
# See gcp-persistent-disk.sh for full documentation and GCP prerequisites.

# create /quadratic-sentry directory
sudo mkdir /quadratic-sentry
sudo chown ubuntu /quadratic-sentry
cd /quadratic-sentry

# clone sentry-selfhost
git clone https://github.com/getsentry/self-hosted.git
cd self-hosted

# install sentry
sudo ./install.sh

# start sentry
sudo docker compose up --wait

echo "Sentry self-host setup complete."

echo "Uncomment the 'system.url-prefix' line in the /quadratic-sentry/self-hosted/config.yml file and set the value to 'https://sentry.quadratichq.com/' and restart docker: 'sudo docker compose restart'"

echo "Add the following to the bottom of the /quadratic-sentry/sentry/sentry.conf.py file:"
echo "SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')"
echo "USE_X_FORWARDED_HOST = True"
echo "SESSION_COOKIE_SECURE = True"
echo "CSRF_COOKIE_SECURE = True"
echo "CSRF_TRUSTED_ORIGINS = ['https://sentry.quadratichq.com']"

echo "Restart docker: 'sudo docker compose restart'"
echo "If docker did not start, run 'sudo docker compose up --wait' in the /quadratic-sentry/self-hosted dir"

echo "To create a new user, run this in the /quadratic-sentry/self-hosted dir: sudo docker compose exec web sentry createuser --superuser"