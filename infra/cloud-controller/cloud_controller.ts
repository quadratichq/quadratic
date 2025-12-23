import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import { redisHost, redisPort } from "../shared/redis";

import {
  cloudControllerEc2SecurityGroup,
  cloudControllerSubnet1,
} from "./cloud_controller_network";
import { runCloudControllerBashScript } from "./cloud_controller_user_data";

const config = new pulumi.Config();

// Configuration from command line
const cloudControllerSubdomain = config.require("cloud-controller-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");
const multiplayerHost = config.require("multiplayer-host");
const multiplayerPort = config.require("multiplayer-port");
const filesHost = config.require("files-host");
const filesPort = config.require("files-port");
const connectionHost = config.require("connection-host");
const connectionPort = config.require("connection-port");
const cloudControllerECRName = config.require("cloud-controller-ecr-repo-name");
const cloudControllerPulumiEscEnvironmentName = config.require(
  "cloud-controller-pulumi-esc-environment-name",
);
// ECR name for the cloud worker image that the controller will spawn
const cloudWorkerECRName = config.require("cloud-worker-ecr-repo-name");

// Configuration from Pulumi ESC
const domain = config.require("domain");
// Default to m5.2xlarge (8 vCPU, 32 GB RAM) - sized for controller + up to 20 cloud workers
const instanceSize =
  config.get("cloud-controller-instance-size") ?? "m5.2xlarge";
// Root volume size in GB - needs space for Docker images and container storage
const rootVolumeSize =
  config.getNumber("cloud-controller-root-volume-size") ?? 100;

// Create a single EC2 instance
// Note: Instance runs BOTH the controller AND multiple cloud workers (up to 20 concurrent)
// The m5.2xlarge default provides adequate CPU/memory for typical workloads
const instance = new aws.ec2.Instance("cloud-controller-instance", {
  tags: {
    Name: `cloud-controller-instance-${cloudControllerSubdomain}`,
  },
  instanceType: instanceSize,
  ami: latestAmazonLinuxAmi.id,
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  vpcSecurityGroupIds: [cloudControllerEc2SecurityGroup.id],
  subnetId: cloudControllerSubnet1,
  userDataReplaceOnChange: true,
  userData: pulumi.all([redisHost, redisPort]).apply(([host, port]) =>
    runCloudControllerBashScript(
      cloudControllerECRName,
      cloudWorkerECRName,
      dockerImageTag,
      cloudControllerPulumiEscEnvironmentName,
      {
        QUADRATIC_API_URI: quadraticApiUri,
        MULTIPLAYER_HOST: multiplayerHost,
        MULTIPLAYER_PORT: multiplayerPort,
        FILES_HOST: filesHost,
        FILES_PORT: filesPort,
        CONNECTION_HOST: connectionHost,
        CONNECTION_PORT: connectionPort,
        PUBSUB_HOST: host,
        PUBSUB_PORT: port.toString(),
        // Bind to all interfaces so external connections work
        PUBLIC_HOST: "0.0.0.0",
        WORKER_ONLY_HOST: "0.0.0.0",
      },
    ),
  ),
  // Root volume sized for Docker images (controller + worker) and container storage
  rootBlockDevice: {
    volumeSize: rootVolumeSize,
    volumeType: "gp3",
    deleteOnTermination: true,
  },
  // Disable detailed monitoring (requires ec2:MonitorInstances permission that CI doesn't have).
  // Basic monitoring is still available (5-minute intervals instead of 1-minute)
  monitoring: false,
});

// Get the hosted zone ID for domain
const hostedZone = pulumi.output(
  aws.route53.getZone(
    {
      name: domain,
    },
    { async: true },
  ),
);

// Create a Route 53 record pointing to EC2 instance
const dnsRecord = new aws.route53.Record("cloud-controller-r53-record", {
  zoneId: hostedZone.id,
  name: `${cloudControllerSubdomain}.${domain}`,
  type: "A",
  ttl: 300,
  records: [instance.publicIp],
});

export const cloudControllerPublicDns = dnsRecord.name;
