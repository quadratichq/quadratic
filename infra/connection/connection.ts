import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { isPreviewEnvironment } from "../helpers/isPreviewEnvironment";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
const config = new pulumi.Config();

// Configuration from command line
const connectionSubdomain = config.require("connection-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");
const connectionECRName = config.require("connection-ecr-repo-name");

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");

// Create a new VPC
const vpc = new aws.ec2.Vpc("connection-vpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsSupport: true,
  enableDnsHostnames: true,
  tags: { Name: "connection-vpc" },
});

// Create a Security Group for the Connection NLB
export const connectionNlbSecurityGroup = new aws.ec2.SecurityGroup(
  "connection-nlb-security-group-1",
  {
    vpcId: vpc.id,
    ingress: [
      {
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
  }
);

// Create a Security Group for the Multiplayer EC2 instance
export const connectionEc2SecurityGroup = new aws.ec2.SecurityGroup(
  "connection-sg-1",
  {
    vpcId: vpc.id,
    ingress: [
      {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        securityGroups: [connectionNlbSecurityGroup.id],
      },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
  }
);

if (isPreviewEnvironment)
  new aws.ec2.SecurityGroupRule(`connection-ssh-ingress-rule`, {
    type: "ingress",
    fromPort: 22,
    toPort: 22,
    protocol: "tcp",
    cidrBlocks: ["0.0.0.0/0"],
    securityGroupId: connectionEc2SecurityGroup.id,
  });

// Create Subnets
const subnet1 = new aws.ec2.Subnet("connection-subnet-1", {
  vpcId: vpc.id,
  cidrBlock: "10.0.1.0/24",
  availabilityZone: "us-west-2a",
  tags: { Name: "connection-subnet-1" },
});

const subnet2 = new aws.ec2.Subnet("connection-subnet-2", {
  vpcId: vpc.id,
  cidrBlock: "10.0.2.0/24",
  availabilityZone: "us-west-2b",
  tags: { Name: "connection-subnet-2" },
});

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("connection-igw", {
  vpcId: vpc.id,
  tags: { Name: "connection-igw" },
});

// Create a NAT Gateway
const natEip1 = new aws.ec2.Eip("nat-eip-1", {
  vpc: true,
});

const natEip2 = new aws.ec2.Eip("nat-eip-2", {
  vpc: true,
});

const natGateway1 = new aws.ec2.NatGateway("connection-nat-gateway-1", {
  allocationId: natEip1.id,
  subnetId: subnet1.id,
  tags: { Name: "connection-nat-gateway-1" },
});

const natGateway2 = new aws.ec2.NatGateway("connection-nat-gateway-2", {
  allocationId: natEip2.id,
  subnetId: subnet2.id,
  tags: { Name: "connection-nat-gateway-2" },
});

// Create a Route Table
const routeTable = new aws.ec2.RouteTable("connection-route-table", {
  vpcId: vpc.id,
  routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: internetGateway.id }],
  tags: { Name: "connection-route-table" },
});

// Associate Subnets with Route Table
new aws.ec2.RouteTableAssociation("connection-subnet-1-association", {
  subnetId: subnet1.id,
  routeTableId: routeTable.id,
});

new aws.ec2.RouteTableAssociation("connection-subnet-2-association", {
  subnetId: subnet2.id,
  routeTableId: routeTable.id,
});

// Create an Auto Scaling Group
const launchConfiguration = new aws.ec2.LaunchConfiguration("connection-lc", {
  instanceType: "t2.micro",
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  imageId: latestAmazonLinuxAmi.id,
  securityGroups: [connectionEc2SecurityGroup.id],
  userData: natEip1.publicIp.apply((publicIp1) =>
    natEip2.publicIp.apply((publicIp2) =>
      runDockerImageBashScript(
        connectionECRName,
        dockerImageTag,
        "quadratic-connection-development",
        {
          QUADRATIC_API_URI: quadraticApiUri,
          STATIC_IPS: `${publicIp1},${publicIp2}`,
        },
        true
      )
    )
  ),
});

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("connection-nlb-tg", {
  port: 80,
  protocol: "TCP",
  targetType: "instance",
  vpcId: vpc.id,
});

const autoScalingGroup = new aws.autoscaling.Group("connection-asg", {
  vpcZoneIdentifiers: [subnet1.id, subnet2.id],
  launchConfiguration: launchConfiguration.id,
  minSize: 2,
  maxSize: 4,
  desiredCapacity: 2,
  tags: [
    {
      key: "Name",
      value: `connection-instance-${connectionSubdomain}`,
      propagateAtLaunch: true,
    },
  ],
  targetGroupArns: [targetGroup.arn],
});

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("connection-nlb", {
  internal: false,
  loadBalancerType: "network",
  subnets: [subnet1.id, subnet2.id],
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
