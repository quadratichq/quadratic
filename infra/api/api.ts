import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import {
  apiAlbSecurityGroup,
  apiEc2SecurityGroup,
  apiEip1,
  apiEip2,
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
const minSize = config.getNumber("api-lb-min-size") ?? 2;
const maxSize = config.getNumber("api-lb-max-size") ?? 5;
const desiredCapacity = config.getNumber("api-lb-desired-capacity") ?? 2;

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
const targetGroup = new aws.lb.TargetGroup("api-alb-tg", {
  tags: { Name: `api-tg-${apiSubdomain}` },

  port: 80,
  protocol: "HTTP",
  targetType: "instance",
  vpcId: apiVPC.id,

  // // Health check configuration
  // healthCheck: {
  //   enabled: true,
  //   path: "/health",
  //   protocol: "HTTP",
  //   healthyThreshold: 2,
  //   unhealthyThreshold: 2,
  //   timeout: 5,
  //   interval: 15,
  //   matcher: "200",
  // },

  // // Connection draining
  // deregistrationDelay: 30,

  // // Stickiness for session persistence
  // stickiness: {
  //   type: "lb_cookie",
  //   cookieDuration: 86400,
  //   enabled: true,
  // },
});

// Create Auto Scaling Group with warm pool
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

  warmPool: {
    minSize: 1,
    maxGroupPreparedCapacity: 2,
    poolState: "Running",
  },

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

// Create Application Load Balancer
const alb = new aws.lb.LoadBalancer("api-alb", {
  tags: {
    Name: `api-alb-${apiSubdomain}`,
  },

  name: `alb-${apiSubdomain}`,
  internal: false,
  loadBalancerType: "application",
  subnets: [apiPublicSubnet1.id, apiPublicSubnet2.id],
  securityGroups: [apiAlbSecurityGroup.id],
  enableHttp2: true,
  enableCrossZoneLoadBalancing: true,
  idleTimeout: 600,
});

// Create HTTP listener with redirect to HTTPS
const httpListener = new aws.lb.Listener("api-alb-http-listener", {
  tags: {
    Name: `api-alb-http-${apiSubdomain}`,
  },

  loadBalancerArn: alb.arn,
  port: 80,
  protocol: "HTTP",
  defaultActions: [
    {
      type: "redirect",
      redirect: {
        port: "443",
        protocol: "HTTPS",
        statusCode: "HTTP_301",
      },
    },
  ],
});

// Create HTTPS listener
const httpsListener = new aws.lb.Listener("api-alb-https-listener", {
  tags: {
    Name: `api-alb-https-${apiSubdomain}`,
  },

  loadBalancerArn: alb.arn,
  port: 443,
  protocol: "HTTPS",
  certificateArn: certificateArn,
  sslPolicy: "ELBSecurityPolicy-TLS13-1-2-Res-2021-06",

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
      {
        fromPort: 80,
        toPort: 80,
      },
    ],
    clientAffinity: "SOURCE_IP",
  },
);

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
        endpointId: alb.arn,
        weight: 100,
        clientIpPreservationEnabled: true,
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
  name: `${apiSubdomain}.${domain}`,
  type: "A",
  aliases: [
    {
      name: apiGlobalAccelerator.dnsName,
      zoneId: "Z2BJ6XQ5FK7U4H", // AWS Global Accelerator zone ID
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

// Additional scaling policy for ALB request count
const albRequestCountScalingPolicy = new aws.autoscaling.Policy(
  "api-alb-request-count-scaling",
  {
    autoscalingGroupName: autoScalingGroup.name,
    policyType: "TargetTrackingScaling",
    targetTrackingConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ALBRequestCountPerTarget",
        resourceLabel: pulumi.interpolate`${alb.arnSuffix}/${targetGroup.arnSuffix}`,
      },
      targetValue: 1000.0,
    },
  },
);

export const apiPublicDns = dnsRecord.name;
