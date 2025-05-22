import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { isPreviewEnvironment } from "../helpers/isPreviewEnvironment";
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

// Calculate the number of instances to launch
let minSize = 2;
let maxSize = 5;
let desiredCapacity = 2;
if (isPreviewEnvironment) minSize = maxSize = desiredCapacity = 1;

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
    { async: true },
  ),
);

// Create a Route 53 record pointing to the NLB
const dnsRecord = new aws.route53.Record("api-r53-record", {
  zoneId: hostedZone.id,
  name: `${apiSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  aliases: [
    {
      name: nlb.dnsName,
      zoneId: nlb.zoneId,
      evaluateTargetHealth: true,
    },
  ],
});

export const apiPublicDns = dnsRecord.name;
