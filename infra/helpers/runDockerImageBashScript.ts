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
  dockerRunOptions: DockerRunOptions,
  pulumiEscEnvironmentName: string,
  extraEnvVars: EnvVariables,
  dependencySetupBashCommand: string = "",
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
${dependencySetupBashCommand}

sudo ${dockerRunContainer(dockerRunOptions)}

# TODO: In preview environments we should disable datadog
echo 'Setting up Datadog agent'
sudo ${dockerRunContainer({
    name: "datadog-agent",
    image: "datadog/agent:latest",
    envFile: ".env",
    volumeMappings: [
      {
        hostPath: "/var/run/docker.sock",
        containerPath: "/var/run/docker.sock",
        permissions: "ro",
      },
      {
        hostPath: "/proc/",
        containerPath: "/host/proc/",
        permissions: "ro",
      },
      {
        hostPath: "/opt/datadog-agent/run",
        containerPath: "/opt/datadog-agent/run",
        permissions: "rw",
      },
      {
        hostPath: "/sys/fs/cgroup/",
        containerPath: "/host/sys/fs/cgroup",
        permissions: "ro",
      },
    ],
  })}

`;
};



interface DockerPortMapping {
  hostPort: number;
  containerPort: number;
}

interface DockerVolumeMapping {
  hostPath: string;
  containerPath: string;
  permissions: string;
}

interface DockerRunOptions {
  name: string;
  image: string;
  portMappings?: DockerPortMapping[];
  envFile?: string;
  volumeMappings?: DockerVolumeMapping[];
  command?: string;
  addHostDns?: boolean;
  addCapabilities?: string[];
}

export const dockerRunContainer = (options: DockerRunOptions) => {
  let runCommand = `docker run -d --restart always --name ${options.name}`;

  if (options.addHostDns) {
    runCommand += " --add-host=host.docker.internal:host-gateway";
  }

  if (options.portMappings) {
    let portMapping = ""
    portMapping = options.portMappings
      .map((portMapping) => `-p ${portMapping.hostPort}:${portMapping.containerPort}`)
      .join(" ");
    runCommand += ` ${portMapping}`;
  }

  if (options.volumeMappings) {
    let volumeMapping = "";
    volumeMapping = options.volumeMappings
      .map(
        (volumeMapping) =>
          `-v ${volumeMapping.hostPath}:${volumeMapping.containerPath}:${volumeMapping.permissions}`
      )
      .join(" ");
    runCommand += ` ${volumeMapping}`;
  }

  if (options.envFile) {
    runCommand += ` --env-file ${options.envFile}`;
  }

  if (options.addCapabilities) {
    runCommand += ` --cap-add ${options.addCapabilities.join(",")}`;
  }

  runCommand += ` ${options.image}`;

  if (options.command) {
    runCommand += ` ${options.command}`;
  }

  return runCommand;
}