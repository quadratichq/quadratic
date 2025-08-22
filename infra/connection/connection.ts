import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import {
  connectionEc2SecurityGroup,
  connectionEip1,
  connectionEip2,
  connectionNlbSecurityGroup,
  connectionPrivateSubnet1,
  connectionPrivateSubnet2,
  connectionPublicSubnet1,
  connectionPublicSubnet2,
  connectionVPC,
} from "./connection_network";

const config = new pulumi.Config();

// Configuration from command line
const connectionSubdomain = config.require("connection-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");
const connectionECRName = config.require("connection-ecr-repo-name");
const connectionPulumiEscEnvironmentName = config.require(
  "connection-pulumi-esc-environment-name",
);

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");
const instanceSize = config.require("connection-instance-size");
const minSize = config.getNumber("connection-lb-min-size") ?? 2;
const maxSize = config.getNumber("connection-lb-max-size") ?? 5;
const desiredCapacity = config.getNumber("connection-lb-desired-capacity") ?? 2;

// Create an Launch Template
const launchTemplate = new aws.ec2.LaunchTemplate("connection-lt", {
  name: `connection-lt-${connectionSubdomain}`,
  imageId: latestAmazonLinuxAmi.id,
  instanceType: instanceSize,
  iamInstanceProfile: {
    name: instanceProfileIAMContainerRegistry.name,
  },
  vpcSecurityGroupIds: [connectionEc2SecurityGroup.id],
  userData: pulumi
    .all([connectionEip1.publicIp, connectionEip2.publicIp])
    .apply(([eip1, eip2]) => {
      const script = runDockerImageBashScript(
        connectionECRName,
        dockerImageTag,
        connectionPulumiEscEnvironmentName,
        {
          QUADRATIC_API_URI: quadraticApiUri,
          STATIC_IPS: `${eip1},${eip2}`,
        },
        true,
      );
      return Buffer.from(script).toString("base64");
    }),
  tagSpecifications: [
    {
      resourceType: "instance",
      tags: {
        Name: `connection-instance-${connectionSubdomain}`,
      },
    },
  ],
  monitoring: {
    enabled: true,
  },
});

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("connection-nlb-tg", {
  tags: { Name: `connection-tg-${connectionSubdomain}` },

  port: 80,
  protocol: "TCP",
  targetType: "instance",
  vpcId: connectionVPC.id,

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

// Create Auto Scaling Group
const autoScalingGroup = new aws.autoscaling.Group("connection-asg", {
  tags: [
    {
      key: "Name",
      value: `connection-instance-${connectionSubdomain}`,
      propagateAtLaunch: true,
    },
  ],

  vpcZoneIdentifiers: [
    connectionPrivateSubnet1.id,
    connectionPrivateSubnet2.id,
  ],
  launchTemplate: {
    id: launchTemplate.id,
    version: launchTemplate.latestVersion.apply((v) => v.toString()),
  },
  minSize,
  maxSize,
  desiredCapacity,
  targetGroupArns: [targetGroup.arn],

  instanceRefresh: {
    strategy: "Rolling",
    preferences: {
      minHealthyPercentage: 50,
      instanceWarmup: "60",
    },
  },

  // Add auto-scaling metrics collection
  enabledMetrics: [
    "GroupMinSize",
    "GroupMaxSize",
    "GroupDesiredCapacity",
    "GroupInServiceInstances",
    "GroupTotalInstances",
  ],
});

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("connection-nlb", {
  name: `nlb-${connectionSubdomain}`,
  internal: false,
  loadBalancerType: "network",
  subnets: [connectionPublicSubnet1.id, connectionPublicSubnet2.id],
  enableCrossZoneLoadBalancing: true,
  securityGroups: [connectionNlbSecurityGroup.id],
});

// Create NLB Listener for TLS on port 443
const nlbListener = new aws.lb.Listener("connection-nlb-listener", {
  tags: {
    Name: `connection-nlb-${connectionSubdomain}`,
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

// Add target-tracking auto-scaling policy for CPU
const targetTrackingScalingPolicy = new aws.autoscaling.Policy(
  "connection-target-tracking-scaling",
  {
    autoscalingGroupName: autoScalingGroup.name,
    policyType: "TargetTrackingScaling",
    targetTrackingConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ASGAverageCPUUtilization",
      },
      targetValue: 70.0,
    },
  },
);

// Additional scaling policy for Network Out
const networkOutScalingPolicy = new aws.autoscaling.Policy(
  "connection-network-out-scaling",
  {
    autoscalingGroupName: autoScalingGroup.name,
    policyType: "TargetTrackingScaling",
    targetTrackingConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ASGAverageNetworkOut",
      },
      targetValue: 500000000, // 500 MB/s per instance
    },
  },
);

// Create Global Accelerator
const connectionGlobalAccelerator = new aws.globalaccelerator.Accelerator(
  "connection-global-accelerator",
  {
    name: `connection-global-accelerator-${connectionSubdomain}`,
    ipAddressType: "IPV4",
    enabled: true,
    tags: {
      Name: "connection-global-accelerator",
      Environment: pulumi.getStack(),
    },
  },
);

const connectionGlobalAcceleratorListener = new aws.globalaccelerator.Listener(
  "connection-global-accelerator-listener",
  {
    acceleratorArn: connectionGlobalAccelerator.id,
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

const connectionGlobalAcceleratorEndpointGroup =
  new aws.globalaccelerator.EndpointGroup(
    "connection-globalaccelerator-endpoint-group",
    {
      listenerArn: connectionGlobalAcceleratorListener.id,
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
const dnsRecord = new aws.route53.Record("connection-r53-record", {
  zoneId: hostedZone.id,
  name: `${connectionSubdomain}.${domain}`,
  type: "A",
  aliases: [
    {
      name: connectionGlobalAccelerator.dnsName,
      zoneId: "Z2BJ6XQ5FK7U4H", // AWS Global Accelerator zone ID
      evaluateTargetHealth: true,
    },
  ],
});

export const connectionPublicDns = dnsRecord.name;
