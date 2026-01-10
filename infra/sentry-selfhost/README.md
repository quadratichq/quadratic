# Sentry Self-Hosted on GCP

This directory contains scripts for deploying Sentry self-hosted on a GCP Compute Engine instance with persistent storage.

## Overview

- **`setup.sh`** - Installs Docker and deploys Sentry self-hosted
- **`gcp-persistent-disk.sh`** - Configures a GCP persistent disk for Docker data storage

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ GCP Compute Engine Instance                             │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ Boot Disk       │    │ Persistent Data Disk        │ │
│  │ (nvme0n1)       │    │ (nvme1n1)                   │ │
│  │                 │    │                             │ │
│  │ - OS            │    │ /mnt/docker-data/docker     │ │
│  │ - Docker Engine │    │   └─ volumes/               │ │
│  │ - Sentry Code   │    │       ├─ sentry-postgres    │ │
│  │                 │    │       ├─ sentry-redis       │ │
│  │                 │    │       ├─ sentry-kafka       │ │
│  │                 │    │       ├─ sentry-clickhouse  │ │
│  │                 │    │       └─ ...                │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Fresh Install (From Scratch)

### Prerequisites

1. GCP project with Compute Engine API enabled
2. Sufficient permissions to create instances and disks
3. A domain configured for Sentry (e.g., `sentry.quadratichq.com`)

### Step 1: Create the Persistent Data Disk

In GCP Console or via Cloud Shell:

```bash
gcloud compute disks create sentry-data-disk \
  --size=500GB \
  --type=pd-ssd \
  --zone=us-central1-b
```

### Step 2: Create the Compute Engine Instance

```bash
gcloud compute instances create quadratic-sentry \
  --zone=us-central1-b \
  --machine-type=e2-standard-4 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --disk=name=sentry-data-disk,device-name=sentry-data,mode=rw
```

Recommended specs:
- **Machine type**: `e2-standard-4` (4 vCPU, 16GB RAM) minimum
- **Boot disk**: 50GB SSD
- **Data disk**: 500GB+ SSD (Sentry can grow quickly)

### Step 3: SSH into the Instance

```bash
gcloud compute ssh quadratic-sentry --zone=us-central1-b
```

### Step 4: Setup the Persistent Disk

Copy `gcp-persistent-disk.sh` to the instance and run:

```bash
chmod +x gcp-persistent-disk.sh

# Find the data disk device
lsblk
# Look for the unpartitioned disk (e.g., /dev/nvme1n1 or /dev/sdb)

# Run the setup (for fresh disk without partitions)
./gcp-persistent-disk.sh --disk /dev/nvme1n1

# Or if the disk has partitions (e.g., from a snapshot)
./gcp-persistent-disk.sh --disk /dev/nvme1n1p1
```

### Step 5: Install Sentry

Copy `setup.sh` to the instance and run:

```bash
chmod +x setup.sh
./setup.sh
```

### Step 6: Configure Sentry

After installation completes:

1. Edit `/quadratic-sentry/self-hosted/config.yml`:
   ```yaml
   system.url-prefix: 'https://sentry.quadratichq.com'
   ```

2. Edit `/quadratic-sentry/self-hosted/sentry/sentry.conf.py`, add at the bottom:
   ```python
   SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
   USE_X_FORWARDED_HOST = True
   SESSION_COOKIE_SECURE = True
   CSRF_COOKIE_SECURE = True
   CSRF_TRUSTED_ORIGINS = ['https://sentry.quadratichq.com']
   ```

3. Restart Sentry:
   ```bash
   cd /quadratic-sentry/self-hosted
   sudo docker compose restart
   ```

4. Create an admin user:
   ```bash
   sudo docker compose exec web sentry createuser --superuser
   ```

---

## Migrating Existing Installation to Persistent Disk

If Sentry is already running and you need to move Docker data to a persistent disk:

### Step 1: Attach a Persistent Disk

Via Cloud Shell (not the instance itself):

```bash
gcloud compute instances attach-disk <instance-name> \
  --disk=<disk-name> \
  --zone=<zone>
```

### Step 2: Run Migration

SSH into the instance:

```bash
# Find the new disk
lsblk

# Run migration (this will stop Docker, copy data, and restart)
./gcp-persistent-disk.sh --migrate --disk /dev/nvme1n1
```

### Step 3: Restart Sentry

```bash
cd /quadratic-sentry/self-hosted
sudo docker compose up --wait
```

---

## Verification Commands

```bash
# Check persistent disk is mounted
df -h /mnt/docker-data

# Check Docker is using the persistent disk
docker info | grep "Docker Root Dir"
# Should show: /mnt/docker-data/docker

# List Sentry volumes
sudo docker volume ls

# Check Sentry status
cd /quadratic-sentry/self-hosted
sudo docker compose ps
```

---

## Disaster Recovery

### Instance Deleted, Disk Preserved

If the instance is deleted but the persistent disk still exists:

1. Create a new instance (Step 2 above), attaching the existing disk
2. SSH in and mount the disk:
   ```bash
   sudo mkdir -p /mnt/docker-data
   sudo mount /dev/nvme1n1p1 /mnt/docker-data
   echo "/dev/nvme1n1p1 /mnt/docker-data ext4 discard,defaults,nofail 0 2" | sudo tee -a /etc/fstab
   ```
3. Install Docker (from `setup.sh`, just the Docker parts)
4. Configure Docker to use the existing data:
   ```bash
   sudo tee /etc/docker/daemon.json > /dev/null <<EOF
   {
     "data-root": "/mnt/docker-data/docker"
   }
   EOF
   sudo systemctl restart docker
   ```
5. Clone and start Sentry:
   ```bash
   sudo mkdir /quadratic-sentry
   cd /quadratic-sentry
   git clone https://github.com/getsentry/self-hosted.git
   cd self-hosted
   sudo docker compose up --wait
   ```

Your existing data (users, projects, events) will be restored from the persistent disk.

### Complete Data Loss

If both instance and disk are lost, you'll need to:
1. Start fresh (follow "Fresh Install" above)
2. Restore from backups (if you have them)

---

## Maintenance

### Upgrading Sentry

```bash
cd /quadratic-sentry/self-hosted
git pull
sudo ./install.sh
sudo docker compose up --wait
```

### Checking Disk Usage

```bash
# Overall disk usage
df -h /mnt/docker-data

# Docker-specific usage
sudo docker system df

# Cleanup unused Docker resources
sudo docker system prune -a
```

### Viewing Logs

```bash
cd /quadratic-sentry/self-hosted

# All services
sudo docker compose logs -f

# Specific service
sudo docker compose logs -f web
sudo docker compose logs -f worker
```

---

## Persisted Volumes

These Docker volumes contain Sentry's data and are stored on the persistent disk:

| Volume                        | Purpose                       |
| ----------------------------- | ----------------------------- |
| `sentry-postgres`             | PostgreSQL database           |
| `sentry-redis`                | Redis cache                   |
| `sentry-kafka`                | Kafka message queue           |
| `sentry-clickhouse`           | ClickHouse analytics database |
| `sentry-data`                 | Sentry file storage           |
| `sentry-symbolicator`         | Debug symbol storage          |
| `sentry-self-hosted_sentry-*` | Additional service data       |

---

## Troubleshooting

### Docker won't start after disk migration

Check the daemon.json is valid:
```bash
cat /etc/docker/daemon.json
sudo journalctl -xeu docker.service
```

### Disk not mounting on reboot

Check fstab entry:
```bash
cat /etc/fstab | grep docker-data
# Should have: nofail option
```

### Sentry services failing

Check container logs:
```bash
cd /quadratic-sentry/self-hosted
sudo docker compose ps
sudo docker compose logs <failing-service>
```

### Out of disk space

Check what's using space:
```bash
sudo du -sh /mnt/docker-data/docker/*
sudo docker system df
```

Cleanup:
```bash
sudo docker system prune -a --volumes
```

