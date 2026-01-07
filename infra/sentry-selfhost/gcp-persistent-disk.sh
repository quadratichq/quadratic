#!/bin/bash

set -euo pipefail

# =============================================================================
# GCP Persistent Disk Setup for Docker Volumes
# 
# This script mounts a GCP persistent disk and configures Docker to use it.
# Can be run standalone for existing setups or called by setup.sh for new installs.
#
# Prerequisites:
#   1. Create a persistent disk in GCP:
#      gcloud compute disks create sentry-data-disk \
#        --size=500GB \
#        --type=pd-ssd \
#        --zone=<your-zone>
#
#   2. Attach the disk to your instance:
#      gcloud compute instances attach-disk <instance-name> \
#        --disk=sentry-data-disk \
#        --zone=<your-zone>
#
# Usage:
#   For new installs:    ./gcp-persistent-disk.sh
#   For existing Docker: ./gcp-persistent-disk.sh --migrate
# =============================================================================

DISK_DEVICE="${DISK_DEVICE:-/dev/sdb}"
MOUNT_POINT="${MOUNT_POINT:-/mnt/docker-data}"
MIGRATE_EXISTING=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --migrate)
      MIGRATE_EXISTING=true
      shift
      ;;
    --disk)
      DISK_DEVICE="$2"
      shift 2
      ;;
    --mount)
      MOUNT_POINT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--migrate] [--disk /dev/sdb] [--mount /mnt/docker-data]"
      exit 1
      ;;
  esac
done

echo "=== GCP Persistent Disk Setup ==="
echo "Disk device: $DISK_DEVICE"
echo "Mount point: $MOUNT_POINT"
echo "Migrate existing data: $MIGRATE_EXISTING"
echo ""

# Verify disk exists
if [ ! -b "$DISK_DEVICE" ]; then
  echo "ERROR: Disk device $DISK_DEVICE not found."
  echo "Available block devices:"
  lsblk
  echo ""
  echo "Make sure you've attached the persistent disk to this instance."
  exit 1
fi

# Create mount point
sudo mkdir -p "$MOUNT_POINT"

# Check if disk is already formatted
if ! sudo blkid "$DISK_DEVICE" &>/dev/null; then
  echo "Formatting persistent disk..."
  sudo mkfs.ext4 -m 0 -E lazy_itable_init=0,lazy_journal_init=0,discard "$DISK_DEVICE"
else
  echo "Disk already formatted, skipping format."
fi

# Check if already mounted
if mountpoint -q "$MOUNT_POINT"; then
  echo "Disk already mounted at $MOUNT_POINT"
else
  echo "Mounting disk..."
  sudo mount -o discard,defaults "$DISK_DEVICE" "$MOUNT_POINT"
fi

# Add to fstab for persistence across reboots
if ! grep -q "$DISK_DEVICE" /etc/fstab; then
  echo "Adding to /etc/fstab..."
  echo "$DISK_DEVICE $MOUNT_POINT ext4 discard,defaults,nofail 0 2" | sudo tee -a /etc/fstab
else
  echo "Already in /etc/fstab, skipping."
fi

# Set proper ownership
sudo chown -R root:root "$MOUNT_POINT"

# Handle Docker configuration
if $MIGRATE_EXISTING; then
  echo ""
  echo "=== Migrating Existing Docker Data ==="
  
  # Check if Docker is running
  if systemctl is-active --quiet docker; then
    echo "Stopping Docker..."
    sudo systemctl stop docker
  fi
  
  # Check if there's existing data to migrate
  if [ -d "/var/lib/docker" ] && [ "$(ls -A /var/lib/docker 2>/dev/null)" ]; then
    if [ -d "$MOUNT_POINT/docker" ] && [ "$(ls -A $MOUNT_POINT/docker 2>/dev/null)" ]; then
      echo "WARNING: Data already exists at $MOUNT_POINT/docker"
      echo "Skipping migration to avoid data loss."
    else
      echo "Copying Docker data to persistent disk (this may take a while)..."
      sudo rsync -aP /var/lib/docker/ "$MOUNT_POINT/docker/"
      echo "Migration complete."
    fi
  else
    echo "No existing Docker data to migrate."
    sudo mkdir -p "$MOUNT_POINT/docker"
  fi
else
  # Fresh install - just create the directory
  sudo mkdir -p "$MOUNT_POINT/docker"
fi

# Configure Docker to use the persistent disk
echo ""
echo "=== Configuring Docker ==="
sudo mkdir -p /etc/docker

if [ -f /etc/docker/daemon.json ]; then
  # Check if data-root is already configured
  if grep -q "data-root" /etc/docker/daemon.json; then
    echo "Docker data-root already configured in daemon.json"
  else
    echo "Updating existing daemon.json..."
    # Use jq if available, otherwise create new file
    if command -v jq &>/dev/null; then
      sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup
      sudo jq ". + {\"data-root\": \"$MOUNT_POINT/docker\"}" /etc/docker/daemon.json.backup | sudo tee /etc/docker/daemon.json > /dev/null
    else
      echo "WARNING: jq not installed. Creating new daemon.json (backup at daemon.json.backup)"
      sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup
      sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "data-root": "$MOUNT_POINT/docker"
}
EOF
    fi
  fi
else
  echo "Creating daemon.json..."
  sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "data-root": "$MOUNT_POINT/docker"
}
EOF
fi

# Restart Docker if it was running or if we're migrating
if $MIGRATE_EXISTING || systemctl is-active --quiet docker; then
  echo "Starting Docker..."
  sudo systemctl start docker
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Docker data location: $MOUNT_POINT/docker"
echo ""
echo "Verification commands:"
echo "  df -h $MOUNT_POINT                        # Check disk is mounted"
echo "  docker info | grep 'Docker Root Dir'     # Verify Docker config"
echo "  sudo docker volume ls                     # List volumes"
echo ""

if $MIGRATE_EXISTING; then
  echo "NOTE: After verifying everything works, you can reclaim boot disk space:"
  echo "  sudo rm -rf /var/lib/docker"
fi

