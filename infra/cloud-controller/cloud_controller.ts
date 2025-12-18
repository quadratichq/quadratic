import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import { redisHost, redisPort } from "../shared/redis";

import {
  cloudControllerEc2SecurityGroup,
  cloudControllerNlbSecurityGroup,
  cloudControllerSubnet1,
  cloudControllerSubnet2,
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
const vpcId = config.require("vpc-id");
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
        // Bind to all interfaces so Docker port mapping works
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

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("cloud-controller-nlb-tg", {
  tags: { Name: `cloud-controller-tg-${cloudControllerSubdomain}` },

  port: 80,
  protocol: "TCP",
  targetType: "instance",
  vpcId: vpcId,

  // Health check configuration
  healthCheck: {
    enabled: true,
    path: "/health",
    protocol: "HTTP",
    healthyThreshold: 2,
    unhealthyThreshold: 2,
    timeout: 5,
    interval: 10,
    matcher: "200",
  },

  // Connection draining
  deregistrationDelay: 30,
});

// Attach the instance to the new Target Group
const targetGroupAttachment = new aws.lb.TargetGroupAttachment(
  "cloud-controller-attach-instance-tg",
  {
    targetId: instance.id,
    targetGroupArn: targetGroup.arn,
  },
);

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("cloud-controller-nlb", {
  internal: false,
  loadBalancerType: "network",
  subnets: [cloudControllerSubnet1, cloudControllerSubnet2],
  enableCrossZoneLoadBalancing: true,
  securityGroups: [cloudControllerNlbSecurityGroup.id],
});

// Create NLB Listener for TCP on port 80
const nlbListener = new aws.lb.Listener("cloud-controller-nlb-listener", {
  tags: {
    Name: `cloud-controller-nlb-${cloudControllerSubdomain}`,
  },
  loadBalancerArn: nlb.arn,
  port: 80,
  protocol: "TCP",
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.arn,
    },
  ],
});

// Create Global Accelerator
const cloudControllerGlobalAccelerator = new aws.globalaccelerator.Accelerator(
  "cloud-controller-global-accelerator",
  {
    name: `cloud-controller-global-accelerator-${cloudControllerSubdomain}`,
    ipAddressType: "IPV4",
    enabled: true,
    tags: {
      Name: "cloud-controller-global-accelerator",
      Environment: pulumi.getStack(),
    },
  },
);

const cloudControllerGlobalAcceleratorListener =
  new aws.globalaccelerator.Listener(
    "cloud-controller-global-accelerator-listener",
    {
      acceleratorArn: cloudControllerGlobalAccelerator.id,
      protocol: "TCP",
      portRanges: [
        {
          fromPort: 80,
          toPort: 80,
        },
      ],
      clientAffinity: "SOURCE_IP",
    },
  );

const cloudControllerGlobalAcceleratorEndpointGroup =
  new aws.globalaccelerator.EndpointGroup(
    "cloud-controller-globalaccelerator-endpoint-group",
    {
      listenerArn: cloudControllerGlobalAcceleratorListener.id,
      endpointConfigurations: [
        {
          endpointId: nlb.arn,
          weight: 100,
          clientIpPreservationEnabled: false,
        },
      ],
      endpointGroupRegion: aws.getRegionOutput().name,
      healthCheckProtocol: "TCP",
      healthCheckPort: 80,
      healthCheckIntervalSeconds: 30,
      thresholdCount: 3,
      trafficDialPercentage: 100,
    },
  );

// Get the hosted zone ID for domain
const hostedZone = pulumi.output(
  aws.route53.getZone(
    {
      name: domain,
    },
    { async: true },
  ),
);

// Create a Route 53 record pointing to Global Accelerator
const dnsRecord = new aws.route53.Record("cloud-controller-r53-record", {
  zoneId: hostedZone.id,
  name: `${cloudControllerSubdomain}.${domain}`,
  type: "A",
  aliases: [
    {
      name: cloudControllerGlobalAccelerator.dnsName,
      zoneId: "Z2BJ6XQ5FK7U4H", // AWS Global Accelerator zone ID
      evaluateTargetHealth: true,
    },
  ],
});

export const cloudControllerPublicDns = dnsRecord.name;
