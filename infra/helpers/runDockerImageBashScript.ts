import * as pulumi from "@pulumi/pulumi";
const config = new pulumi.Config();

const ecrRegistryUrl = config.require("ecr-registry-url");
const pulumiAccessToken = config.require("pulumi-access-token");

interface EnvVariables {
  [key: string]: string;
}

/**
 * Creates a bash command to set environment variables
 *
 * @param envVariables An object containing environment variables.
 */
const createBashCommandForEnv = (envVariables: EnvVariables) => {
  let bashCommand = "";
  for (const key in envVariables) {
    if (envVariables.hasOwnProperty(key)) {
      const value = envVariables[key];
      // Use '>>' to append to the .env file
      // Be aware that if value contains special characters, it should be properly escaped
      bashCommand += `echo "${key}=${value}" >> .env\n`;
    }
  }
  return bashCommand;
};

/**
 * UserData script to run a docker image from ECR on an EC2 instance
 *
 * @param imageRepositoryName The name of the Docker image repository.
 * @param imageTag The tag of the Docker image to run.
 * @param pulumiEscEnvironmentName The Pulumi environment name to pull ENV Variables.
 * @param extraEnvVars An object containing additional environment variables.
 * @param rebuildOnEveryPulumiRun If true, a random nonce will be added to the Docker image tag to force a rebuild on every run. userDataReplaceOnChange: true must be set on the EC2 instance.
 */
export const runDockerImageBashScript = (
  imageRepositoryName: string,
  imageTag: string,
  pulumiEscEnvironmentName: string,
  extraEnvVars: EnvVariables,
  rebuildOnEveryPulumiRun: boolean = false
) => {
  const extraEnvVarsBashCommand = createBashCommandForEnv(extraEnvVars);

  let rebuildNonce = 0;
  if (rebuildOnEveryPulumiRun) {
    rebuildNonce = Math.floor(Math.random() * 1000000000000);
  }

  return `#!/bin/bash
echo 'rebuildNonce: ${rebuildNonce}'
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
esc env open quadratic/${pulumiEscEnvironmentName} --format dotenv > .env
sed -i 's/"//g' .env
${extraEnvVarsBashCommand}

echo 'Ensure AWS Cli is installed'
sudo yum install aws-cli -y

echo 'Logging into ECR'
aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin ${ecrRegistryUrl}

echo 'Pulling and running Docker image from ECR'
sudo docker pull ${ecrRegistryUrl}/${imageRepositoryName}:${imageTag}
sudo docker run -d \
            --name ${imageRepositoryName} \
            --restart always \
            -p 80:80 \
            --env-file .env \
            ${ecrRegistryUrl}/${imageRepositoryName}:${imageTag}

# TODO: In preview environments we should disable datadog
echo 'Setting up Datadog agent'
docker run -d --name datadog-agent \
            --restart always \
            --env-file .env \
            -v /var/run/docker.sock:/var/run/docker.sock:ro \
            -v /proc/:/host/proc/:ro \
            -v /opt/datadog-agent/run:/opt/datadog-agent/run:rw \
            -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
            datadog/agent:latest`;
};
