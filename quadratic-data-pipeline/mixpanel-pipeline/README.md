# Mixpanel Data Pipeline - Docker Setup

This directory contains a Meltano-based data pipeline that extracts data from Mixpanel and loads it to S3 in Parquet format using Docker.

## Prerequisites

- Docker
- Docker Compose
- Mixpanel API credentials
- AWS S3 credentials

## Quick Start

### For LocalStack (Local Testing):

1. **Make sure LocalStack is running at the project root:**
   ```bash
   # From the project root directory
   docker-compose up -d localstack
   ```

2. **Setup LocalStack resources:**
   ```bash
   ./setup-localstack.sh
   ```

3. **Copy and configure environment file:**
   ```bash
   cp .env.example .env
   # The .env file is pre-configured for LocalStack with dummy credentials
   # You only need to add your real Mixpanel API credentials
   ```

4. **Build and start the pipeline containers:**
   ```bash
   docker-compose up -d
   ```

### For AWS (Production):

1. **Copy the environment file and configure your credentials:**
   ```bash
   cp .env.example .env
   # Edit .env file with your actual AWS and Mixpanel credentials
   # Remove or comment out the AWS_ENDPOINT_URL variables for production
   ```

2. **Build and start the containers:**
   ```bash
   docker-compose up -d
   ```

3. **Initialize the pipeline (first time only):**
   ```bash
   docker-compose exec meltano ./init.sh
   ```
   This will add plugins, update locks, and install them.

4. **Run the pipeline:**
   ```bash
   docker-compose exec meltano ./run-pipeline.sh
   ```
   This will configure the plugins with your .env variables and run the data extraction.

## Development Commands

### Access the container shell:
```bash
docker-compose exec meltano bash
```

### View Meltano UI (optional):
```bash
docker-compose exec meltano meltano ui start --bind 0.0.0.0:5000
```
Then access http://localhost:5000

### Install plugins manually:
```bash
docker-compose exec meltano meltano install
```

### Run individual commands:
```bash
# Test extractor
docker-compose exec meltano meltano invoke tap-mixpanel --discover

# Test loader
docker-compose exec meltano meltano invoke target-s3-parquet --help

# Run pipeline with specific config
docker-compose exec meltano meltano run tap-mixpanel target-s3-parquet
```

### View logs:
```bash
docker-compose logs -f meltano
```

## Configuration

All configuration is done through environment variables in the `.env` file. Copy `env.example` to `.env` and update the values:

### Mixpanel Configuration:
- `TAP_MIXPANEL_API_SECRET`: Your Mixpanel API secret
- `TAP_MIXPANEL_PROJECT_ID`: Your Mixpanel project ID
- `TAP_MIXPANEL_START_DATE`: Start date for data extraction (YYYY-MM-DD)
- `TAP_MIXPANEL_PROJECT_TIMEZONE`: Project timezone (default: UTC)
- `TAP_MIXPANEL_DATE_WINDOW_SIZE`: Date window size in days (default: 30)
- `TAP_MIXPANEL_ATTRIBUTION_WINDOW`: Attribution window in days (default: 5)
- `TAP_MIXPANEL_USER_AGENT`: User agent string (default: tap-mixpanel/1.0)

### AWS S3 Configuration:
- `TARGET_S3_PARQUET_AWS_ACCESS_KEY_ID`: AWS access key
- `TARGET_S3_PARQUET_AWS_SECRET_ACCESS_KEY`: AWS secret key
- `TARGET_S3_PARQUET_S3_BUCKET`: S3 bucket name
- `TARGET_S3_PARQUET_S3_KEY_PREFIX`: Prefix for S3 keys (e.g., "mixpanel/")
- `TARGET_S3_PARQUET_AWS_REGION`: AWS region (default: us-east-1)

### Meltano Configuration:
- `MELTANO_ENVIRONMENT`: Environment name (default: dev)
- `MELTANO_DATABASE_URI`: Database URI (default: sqlite:///meltano.db)

## Troubleshooting

### Revenue endpoint error (expected behavior):
The pipeline may show an error like "Invalid endpoint: revenue" at the end of execution. This is expected and does not affect data extraction. The revenue endpoint is not available for all Mixpanel accounts and is disabled by default (`disable_revenue: true` in meltano.yml). All other data streams (export, engage, funnels, cohorts, cohort_members) will complete successfully.

### Plugin installation fails:
```bash
# Rebuild the Docker image
docker-compose build --no-cache
docker-compose up -d
```

### Permission issues:
```bash
# Fix file permissions
docker-compose exec meltano chown -R meltano:meltano /project
```

### View detailed logs:
```bash
docker-compose exec meltano meltano run tap-mixpanel target-s3-parquet --log-level debug
```

## File Structure

- `meltano.yml` - Meltano project configuration
- `Dockerfile` - Docker image definition
- `docker-compose.yml` - Docker Compose services
- `init.sh` - Plugin initialization script
- `run-pipeline.sh` - Pipeline execution script
- `output/` - Local output directory (mounted as volume)
- `.meltano/` - Meltano internal files (mounted as volume)

## Cleanup

```bash
# Stop containers
docker-compose down

# Remove volumes (WARNING: This will delete all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```
