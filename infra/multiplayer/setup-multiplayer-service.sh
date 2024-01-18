#!/bin/bash
# Create a systemd service
cat <<EOF | sudo tee /etc/systemd/system/quadratic-multiplayer.service
[Unit]
Description=Quadratic Multiplayer Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/ubuntu/
ExecStart=/home/ubuntu/quadratic-multiplayer
Restart=always
Environment="HOST=0.0.0.0"
Environment="PORT=80"
Environment="HEARTBEAT_CHECK_S=15"
Environment="HEARTBEAT_TIMEOUT_S=60"
Environment="QUADRATIC_API_URI={{QUADRATIC_API_URI}}"
Environment="QUADRATIC_API_JWT=ADD_TOKEN_HERE"
Environment="AUTH0_JWKS_URI=https://dev-nje7dw8s.us.auth0.com/.well-known/jwks.json"
Environment="AUTHENTICATE_JWT=true"
Environment="AWS_S3_BUCKET_NAME=quadratic-development"
Environment="AWS_S3_REGION=us-west-2"
Environment="AWS_S3_ACCESS_KEY_ID={{MULTIPLAYER_AWS_S3_ACCESS_KEY_ID}}"
Environment="AWS_S3_SECRET_ACCESS_KEY={{MULTIPLAYER_AWS_S3_SECRET_ACCESS_KEY}}"
Environment="PUBSUB_HOST={{PUBSUB_HOST}}"
Environment="PUBSUB_PORT={{PUBSUB_PORT}}"
Environment="PUBSUB_PASSWORD="
Environment="PUBSUB_ACTIVE_CHANNELS=active_channels"

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable and start the servicesudo systemctl status quadratic-multiplayer.service
sudo systemctl status quadratic-multiplayer.service

sudo systemctl enable quadratic-multiplayer

# sudo systemctl start quadratic-multiplayer
# view logs of service
# journalctl -u quadratic-multiplayer.service

echo 'Install Data Dog Agent'
DD_ENV={{DD_ENV}} DD_API_KEY={{DD_API_KEY}} DD_SITE="us5.datadoghq.com" DD_APM_INSTRUMENTATION_ENABLED=host bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"