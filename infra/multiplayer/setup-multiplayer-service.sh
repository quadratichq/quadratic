#!/bin/bash
# Install the quadratic-multiplayer service
cat <<EOF | sudo tee /home/ubuntu/start-quadratic-multiplayer.sh
#!/bin/bash

echo 'Installing Pulumi ESC CLI'
curl -fsSL https://get.pulumi.com/esc/install.sh | sh
export PATH=$PATH:/.pulumi/bin
export PULUMI_ACCESS_TOKEN={{pulumiAccessToken}}
esc login

echo 'Setting ENV Vars'
eval $(esc env open quadratic/quadratic-multiplayer-development --format shell)

# Start the quadratic-multiplayer service
exec /home/ubuntu/quadratic-multiplayer
EOF
sudo chmod +x /home/ubuntu/start-quadratic-multiplayer.sh

# Create a systemd service
cat <<EOF | sudo tee /etc/systemd/system/quadratic-multiplayer.service
[Unit]
Description=Quadratic Multiplayer Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/ubuntu/
ExecStart=/home/ubuntu/start-quadratic-multiplayer.sh
Restart=always
Environment="QUADRATIC_API_URI={{QUADRATIC_API_URI}}"
Environment="PUBSUB_HOST={{PUBSUB_HOST}}"
Environment="PUBSUB_PORT={{PUBSUB_PORT}}"

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