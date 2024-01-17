#!/bin/bash
echo 'Installing Docker'
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

echo 'Installing Pulumi ESC CLI'
curl -fsSL https://get.pulumi.com/esc/install.sh | sh
export PATH=$PATH:/.pulumi/bin
export PULUMI_ACCESS_TOKEN=${pulumiAccessToken}
esc login

echo 'Setting ENV Vars'
esc env open quadratic/quadratic-files-development --format dotenv > .env
sed -i 's/"//g' .env
echo PUBSUB_HOST=${redisHost} >> .env
echo PUBSUB_PORT=${redisPort} >> .env
echo QUADRATIC_API_URI=${quadraticApiUri} >> .env

echo 'Ensure AWS Cli is installed'
sudo yum install aws-cli -y

echo 'Logging into ECR'
aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin ${ecrRegistryUrl}

echo 'Pulling and running Docker image from ECR'
sudo docker pull ${ecrRegistryUrl}/quadratic-files-development:${dockerImageTag}
sudo docker run -d -p 80:80 --env-file .env --restart-always ${ecrRegistryUrl}/quadratic-files-development:${dockerImageTag}