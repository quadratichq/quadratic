#!/bin/bash

echo 'Setting Up SSH Key'
mkdir -p ~/.ssh
echo "$EC2_KEY_PEM" > ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa


echo 'Wait for EC2 Availability'
timeout=300 # 5 minutes
elapsed=0
echo "Checking EC2 instance availability..."
while ! ssh -o "StrictHostKeyChecking=no" -i ~/.ssh/id_rsa ubuntu@$EC2_INSTANCE_DNS "echo 'EC2 instance is up and running'" && [ $elapsed -lt $timeout ]; do
    echo "Waiting for EC2 instance to be available..."
    sleep 10
    elapsed=$((elapsed + 10))
done
if [ $elapsed -ge $timeout ]; then
    echo "Timeout waiting for EC2 instance to become available"
    exit 1
fi
echo "EC2 instance is available"



echo 'Stop Service on EC2'
ssh -i ~/.ssh/id_rsa ubuntu@$EC2_INSTANCE_DNS "sudo systemctl stop quadratic-multiplayer && rm -f /home/ubuntu/quadratic-multiplayer"

echo 'Transfer Build to EC2'
scp -i ~/.ssh/id_rsa target/release/quadratic-multiplayer ubuntu@$EC2_INSTANCE_DNS:/home/ubuntu/

echo 'Restart Service on EC2'
ssh -i ~/.ssh/id_rsa ubuntu@$EC2_INSTANCE_DNS "sudo systemctl start quadratic-multiplayer"

echo 'Verify Service is running on EC2'
ssh -i ~/.ssh/id_rsa ubuntu@$EC2_INSTANCE_DNS "sudo systemctl is-active --quiet quadratic-multiplayer"