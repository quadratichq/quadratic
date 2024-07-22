import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { isPreviewEnvironment } from "../helpers/isPreviewEnvironment";
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
  "connection-pulumi-esc-environment-name"
);

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");
const instanceSize = config.require("connection-instance-size");

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("connection-nlb-tg", {
  port: 80,
  protocol: "TCP",
  targetType: "instance",
  vpcId: connectionVPC.id,
});

// Step 1: Create or update the Launch Template
const launchTemplate = new aws.ec2.LaunchTemplate("connection-lt", {
  instanceType: instanceSize,
  iamInstanceProfile: {
    name: instanceProfileIAMContainerRegistry.name,
  },
  imageId: latestAmazonLinuxAmi.id,
  vpcSecurityGroupIds: [connectionEc2SecurityGroup.id],
  userData: connectionEip1.publicIp.apply((publicIp1) =>
    connectionEip2.publicIp.apply((publicIp2) =>
      runDockerImageBashScript(
        connectionECRName,
        dockerImageTag,
        connectionPulumiEscEnvironmentName,
        {
          QUADRATIC_API_URI: quadraticApiUri,
          STATIC_IPS: `${publicIp1},${publicIp2}`,
        },
        true
      )
    )
  ),
});

// Step 2: Create or update the Auto Scaling Group to use the new Launch Template

// Calculate the number of instances to launch
let minSize = 2;
let maxSize = 5;
let desiredCapacity = 2;
if (isPreviewEnvironment) minSize = maxSize = desiredCapacity = 1;

const autoScalingGroup = new aws.autoscaling.Group("connection-asg", {
  vpcZoneIdentifiers: [
    connectionPrivateSubnet1.id,
    connectionPrivateSubnet2.id,
  ],
  launchTemplate: {
    id: launchTemplate.id,
    version: "$Latest",
  },
  minSize,
  maxSize,
  desiredCapacity,
  tags: [
    {
      key: "Name",
      value: `connection-instance-${connectionSubdomain}`,
      propagateAtLaunch: true,
    },
  ],
  targetGroupArns: [targetGroup.arn],
  instanceRefresh: {
    strategy: "Rolling",
    preferences: {
      minHealthyPercentage: 90,
    },
  },
});

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("connection-nlb", {
  name: connectionSubdomain,
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

// Get the hosted zone ID for domain
const hostedZone = pulumi.output(
  aws.route53.getZone(
    {
      name: domain,
    },
    { async: true }
  )
);

// Create a Route 53 record pointing to the NLB
const dnsRecord = new aws.route53.Record("connection-r53-record", {
  zoneId: hostedZone.id,
  name: `${connectionSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  aliases: [
    {
      name: nlb.dnsName,
      zoneId: nlb.zoneId,
      evaluateTargetHealth: true,
    },
  ],
});

export const connectionPublicDns = dnsRecord.name;
