import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import { redisHost, redisPort } from "../shared/redis";
import {
  multiplayerEc2SecurityGroup,
  multiplayerNlbSecurityGroup,
} from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const multiplayerSubdomain = config.require("multiplayer-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");
const multiplayerECRName = config.require("multiplayer-ecr-repo-name");
const multiplayerPulumiEscEnvironmentName = config.require(
  "multiplayer-pulumi-esc-environment-name",
);

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");
const subNet1 = config.require("subnet1");
const subNet2 = config.require("subnet2");
const vpcId = config.require("vpc-id");
const instanceSize = config.require("multiplayer-instance-size");

const instance = new aws.ec2.Instance("multiplayer-instance", {
  tags: {
    Name: `multiplayer-instance-${multiplayerSubdomain}`,
  },
  instanceType: instanceSize,
  ami: latestAmazonLinuxAmi.id,
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  vpcSecurityGroupIds: [multiplayerEc2SecurityGroup.id],
  subnetId: subNet1, // Assign a subnet, otherwise a random one will be chosen which could be disconnected from the NLB
  // Run Setup script on instance boot to create multiplayer systemd service
  userDataReplaceOnChange: true,
  userData: pulumi.all([redisHost, redisPort]).apply(([host, port]) =>
    runDockerImageBashScript(
      multiplayerECRName,
      dockerImageTag,
      multiplayerPulumiEscEnvironmentName,
      {
        PUBSUB_HOST: host,
        PUBSUB_PORT: port.toString(),
        QUADRATIC_API_URI: quadraticApiUri,
      },
      true,
    ),
  ),
});

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("multiplayer-nlb-tg", {
  tags: { Name: `multiplayer-tg-${multiplayerSubdomain}` },

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
  "multiplayer-attach-instance-tg",
  {
    targetId: instance.id,
    targetGroupArn: targetGroup.arn,
  },
);

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("multiplayer-nlb", {
  internal: false,
  loadBalancerType: "network",
  subnets: [subNet1, subNet2],
  enableCrossZoneLoadBalancing: true,
  securityGroups: [multiplayerNlbSecurityGroup.id],
});

// Create NLB Listener for TLS on port 443
const nlbListener = new aws.lb.Listener("multiplayer-nlb-listener", {
  tags: {
    Name: `multiplayer-nlb-${multiplayerSubdomain}`,
  },
  loadBalancerArn: nlb.arn,
  port: 443,
  protocol: "TLS",
  certificateArn: certificateArn, // Attach the SSL certificate
  sslPolicy: "ELBSecurityPolicy-2016-08", // Choose an appropriate SSL policy
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.arn,
    },
  ],
});

// Create Global Accelerator
const multiplayerGlobalAccelerator = new aws.globalaccelerator.Accelerator(
  "multiplayer-global-accelerator",
  {
    name: `multiplayer-global-accelerator-${multiplayerSubdomain}`,
    ipAddressType: "IPV4",
    enabled: true,
    tags: {
      Name: "multiplayer-global-accelerator",
      Environment: pulumi.getStack(),
    },
  },
);

const multiplayerGlobalAcceleratorListener = new aws.globalaccelerator.Listener(
  "multiplayer-global-accelerator-listener",
  {
    acceleratorArn: multiplayerGlobalAccelerator.id,
    protocol: "TCP",
    portRanges: [
      {
        fromPort: 443,
        toPort: 443,
      },
    ],
    clientAffinity: "SOURCE_IP",
  },
);

const multiplayerGlobalAcceleratorEndpointGroup =
  new aws.globalaccelerator.EndpointGroup(
    "multiplayer-globalaccelerator-endpoint-group",
    {
      listenerArn: multiplayerGlobalAcceleratorListener.id,
      endpointConfigurations: [
        {
          endpointId: nlb.arn,
          weight: 100,
          clientIpPreservationEnabled: false,
        },
      ],
      endpointGroupRegion: aws.getRegionOutput().name,
      healthCheckProtocol: "TCP",
      healthCheckPort: 443,
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
const dnsRecord = new aws.route53.Record("multiplayer-r53-record", {
  zoneId: hostedZone.id,
  name: `${multiplayerSubdomain}.${domain}`,
  type: "A",
  aliases: [
    {
      name: multiplayerGlobalAccelerator.dnsName,
      zoneId: "Z2BJ6XQ5FK7U4H", // AWS Global Accelerator zone ID
      evaluateTargetHealth: true,
    },
  ],
});

export const multiplayerPublicDns = dnsRecord.name;
