import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

const ecrRegistryUrl = config.require("ecr-registry-url");
const pulumiAccessToken = config.require("pulumi-access-token");

interface EnvVariables {
  [key: string]: string;
}

/**
 * Creates a bash command to set environment variables
 */
const createBashCommandForEnv = (envVariables: EnvVariables) => {
  let bashCommand = "";
  for (const key in envVariables) {
    if (envVariables.hasOwnProperty(key)) {
      const value = envVariables[key];
      bashCommand += `echo "${key}=${value}" >> .env\n`;
    }
  }
  return bashCommand;
};

/**
 * UserData script specifically for the cloud-controller service.
 *
 * This differs from the standard runDockerImageBashScript because:
 * 1. Mounts the Docker socket so the controller can spawn cloud worker containers
 * 2. Pre-pulls the cloud worker image for faster worker startup
 * 3. Creates a Docker network for controller-worker communication
 *
 * @param controllerImageRepositoryName The ECR repository name for the cloud controller
 * @param workerImageRepositoryName The ECR repository name for the cloud worker
 * @param imageTag The Docker image tag to use
 * @param pulumiEscEnvironmentName The Pulumi ESC environment name for secrets
 * @param extraEnvVars Additional environment variables
 */
export const runCloudControllerBashScript = (
  controllerImageRepositoryName: string,
  workerImageRepositoryName: string,
  imageTag: string,
  pulumiEscEnvironmentName: string,
  extraEnvVars: EnvVariables,
) => {
  const extraEnvVarsBashCommand = createBashCommandForEnv(extraEnvVars);

  // Random nonce to force rebuild on every Pulumi run
  const rebuildNonce = Math.floor(Math.random() * 1000000000000);

  return `#!/bin/bash
echo 'rebuildNonce: ${rebuildNonce}'
echo 'Installing Docker'
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# Add ec2-user to docker group (for debugging via SSH if needed)
sudo usermod -aG docker ec2-user

echo 'Installing Pulumi ESC CLI'
curl -fsSL https://get.pulumi.com/esc/install.sh | sh
export PATH=$PATH:/.pulumi/bin
export PULUMI_ACCESS_TOKEN=${pulumiAccessToken}
esc login

echo 'Setting ENV Vars'
esc env open quadratic/${pulumiEscEnvironmentName} --format dotenv > .env
sed -i 's/="\\(.*\\)"$/=\\1/; s/='"'"'\\(.*\\)'"'"'$/=\\1/' .env
${extraEnvVarsBashCommand}

echo 'Ensure AWS Cli is installed'
sudo yum install aws-cli -y

echo 'Logging into ECR'
aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin ${ecrRegistryUrl}

echo 'Pre-pulling cloud worker image for faster worker startup'
sudo docker pull ${ecrRegistryUrl}/${workerImageRepositoryName}:${imageTag} || echo 'Worker image pull failed - will pull on demand'

echo 'Pulling and running cloud controller from ECR'
sudo docker pull ${ecrRegistryUrl}/${controllerImageRepositoryName}:${imageTag}

# Run cloud controller with Docker socket mounted
# This allows the controller to spawn and manage cloud worker containers
#
# Key networking architecture:
#   - Controller exposes port 80 (public/healthcheck) and port 8080 (worker-only) on the HOST
#   - Cloud workers are spawned as sibling containers by the controller
#   - Workers use "host.docker.internal" to reach the controller via the host machine
#   - The Container implementation in quadratic-rust-shared automatically adds
#     host.docker.internal:host-gateway to worker containers
#
# Port mapping:
#   - 80:80   -> Public server (health checks, JWKS)
#   - 8080:8080 -> Worker-only server (task distribution, worker shutdown, task ack)
#
sudo docker run -d \\
            --name ${controllerImageRepositoryName} \\
            --restart always \\
            -p 80:80 \\
            -p 8080:8080 \\
            -v /var/run/docker.sock:/var/run/docker.sock \\
            --env-file .env \\
            -e DOCKER_HOST=unix:///var/run/docker.sock \\
            -e WORKER_INTERNAL_HOST=host.docker.internal \\
            ${ecrRegistryUrl}/${controllerImageRepositoryName}:${imageTag}

# In preview environments disable datadog by not passing DD_API_KEY in Pulumi ENV
echo 'Setting up Datadog agent'
docker run -d --name datadog-agent \\
            --restart always \\
            --env-file .env \\
            -v /var/run/docker.sock:/var/run/docker.sock:ro \\
            -v /proc/:/host/proc/:ro \\
            -v /opt/datadog-agent/run:/opt/datadog-agent/run:rw \\
            -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \\
            datadog/agent:latest`;
};

