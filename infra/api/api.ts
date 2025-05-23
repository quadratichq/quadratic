import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import {
  apiEc2SecurityGroup,
  apiEip1,
  apiEip2,
  apiNlbSecurityGroup,
  apiPrivateSubnet1,
  apiPrivateSubnet2,
  apiPublicSubnet1,
  apiPublicSubnet2,
  apiVPC,
} from "./api_network";

const config = new pulumi.Config();

// Configuration from command line
const apiSubdomain = config.require("api-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const apiECRName = config.require("api-ecr-repo-name");
const apiPulumiEscEnvironmentName = config.require(
  "api-pulumi-esc-environment-name",
);

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");
const instanceSize = config.require("api-instance-size");

// Read values and log them
const configuredMinSize = config.getNumber("api-lb-min-size");
const configuredMaxSize = config.getNumber("api-lb-max-size");
const configuredDesiredCapacity = config.getNumber("api-lb-desired-capacity");

pulumi.log.info(`Configured api-lb-min-size: ${configuredMinSize}`);
pulumi.log.info(`Configured api-lb-max-size: ${configuredMaxSize}`);
pulumi.log.info(
  `Configured api-lb-desired-capacity: ${configuredDesiredCapacity}`,
);

const minSize = configuredMinSize ?? 2;
const maxSize = configuredMaxSize ?? 5;
const desiredCapacity = configuredDesiredCapacity ?? 2;

pulumi.log.info(`Effective minSize: ${minSize}`);
pulumi.log.info(`Effective maxSize: ${maxSize}`);
pulumi.log.info(`Effective desiredCapacity: ${desiredCapacity}`);

// Create an Auto Scaling Group
const launchConfiguration = new aws.ec2.LaunchConfiguration("api-lc", {
  instanceType: instanceSize,
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  imageId: latestAmazonLinuxAmi.id,
  securityGroups: [apiEc2SecurityGroup.id],
  userData: pulumi
    .all([apiEip1.publicIp, apiEip2.publicIp])
    .apply(([eip1, eip2]) =>
      runDockerImageBashScript(
        apiECRName,
        dockerImageTag,
        apiPulumiEscEnvironmentName,
        {},
        true,
      ),
    ),
});

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("api-nlb-tg", {
  port: 80,
  protocol: "TCP",
  targetType: "instance",
  vpcId: apiVPC.id,
});

const autoScalingGroup = new aws.autoscaling.Group("api-asg", {
  tags: [
    {
      key: "Name",
      value: `api-instance-${apiSubdomain}`,
      propagateAtLaunch: true,
    },
  ],
  vpcZoneIdentifiers: [apiPrivateSubnet1.id, apiPrivateSubnet2.id],
  launchConfiguration: launchConfiguration.id,
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
const nlb = new aws.lb.LoadBalancer("api-nlb", {
  name: `nlb-${apiSubdomain}`,
  internal: false,
  loadBalancerType: "network",
  subnets: [apiPublicSubnet1.id, apiPublicSubnet2.id],
  enableCrossZoneLoadBalancing: true,
  securityGroups: [apiNlbSecurityGroup.id],
});

// Create NLB Listener for TLS on port 443
const nlbListener = new aws.lb.Listener("api-nlb-listener", {
  tags: {
    Name: `api-nlb-${apiSubdomain}`,
  },
  loadBalancerArn: nlb.arn,
  port: 443,
  protocol: "TLS",
  certificateArn: certificateArn, // Attach the SSL certificate
  sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06", // Choose an appropriate SSL policy
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.arn,
    },
  ],
});

// Create Global Accelerator
const apiGlobalAccelerator = new aws.globalaccelerator.Accelerator(
  "api-global-accelerator",
  {
    name: "api-global-accelerator",
    ipAddressType: "IPV4",
    enabled: true,
    tags: {
      Name: "api-global-accelerator",
      Environment: pulumi.getStack(),
    },
  },
);

// Create listener for HTTPS traffic
const apiGlobalAcceleratorListener = new aws.globalaccelerator.Listener(
  "api-global-accelerator-listener",
  {
    acceleratorArn: apiGlobalAccelerator.id,
    protocol: "TCP",
    portRanges: [
      {
        fromPort: 443,
        toPort: 443,
      },
    ],
    clientAffinity: "SOURCE_IP", // Maintains session persistence
  },
);

// Create endpoint group pointing to the NLB
const apiGlobalAcceleratorEndpointGroup =
  new aws.globalaccelerator.EndpointGroup("api-endpoint-group", {
    listenerArn: apiGlobalAcceleratorListener.id,
    endpointGroupRegion: aws.getRegionOutput().name,

    // Configure health checks
    healthCheckProtocol: "TCP",
    healthCheckPort: 443,
    healthCheckIntervalSeconds: 30,
    thresholdCount: 3,

    // Configure traffic dial percentage (useful for blue-green deployments)
    trafficDialPercentage: 100,

    endpointConfigurations: [
      {
        endpointId: nlb.arn,
        weight: 100,
        clientIpPreservationEnabled: false,
      },
    ],
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

// Create a Route 53 record pointing to Global Accelerator
const dnsRecord = new aws.route53.Record("api-r53-record", {
  zoneId: hostedZone.id,
  name: `${apiSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  aliases: [
    {
      name: apiGlobalAccelerator.dnsName,
      zoneId: "Z2BJ6XQ5FK7U4H", // This is the generic AWS Global Accelerator zone ID
      evaluateTargetHealth: true,
    },
  ],
});

// Add target-tracking auto-scaling policy
const targetTrackingScalingPolicy = new aws.autoscaling.Policy(
  "api-target-tracking-scaling",
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

export const apiPublicDns = dnsRecord.name;
