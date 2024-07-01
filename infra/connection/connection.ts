import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import { redisHost, redisPort } from "../shared/redis";
import {
  connectionEc2SecurityGroup,
  connectionNlbSecurityGroup,
} from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const connectionSubdomain = config.require("connection-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");
const connectionECRName = config.require("connection-ecr-repo-name");
const ecrRegistryUrl = config.require("ecr-registry-url");

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");
const subNet1 = config.require("subnet1");
const subNet2 = config.require("subnet2");
const vpcId = config.require("vpc-id");

// Allocate Elastic IPs for the NAT Gateways
const eip1 = new aws.ec2.Eip("nat-eip-1");
const eip2 = new aws.ec2.Eip("nat-eip-2");

// Create NAT Gateways in each public subnet
const natGateway1 = new aws.ec2.NatGateway("nat-gateway-1", {
  allocationId: eip1.id,
  subnetId: subNet1,
});

const natGateway2 = new aws.ec2.NatGateway("nat-gateway-2", {
  allocationId: eip2.id,
  subnetId: subNet2,
});

// Create route tables for private subnets
const privateRouteTable1 = new aws.ec2.RouteTable("private-route-table-1", {
  vpcId: vpcId,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway1.id,
    },
  ],
});

const privateRouteTable2 = new aws.ec2.RouteTable("private-route-table-2", {
  vpcId: vpcId,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway2.id,
    },
  ],
});

// Associate the private subnets with the route tables
new aws.ec2.RouteTableAssociation("private-subnet-1-association", {
  subnetId: subNet1,
  routeTableId: privateRouteTable1.id,
});

new aws.ec2.RouteTableAssociation("private-subnet-2-association", {
  subnetId: subNet2,
  routeTableId: privateRouteTable2.id,
});

// create the instance
const instance = new aws.ec2.Instance("connection-instance", {
  tags: {
    Name: `connection-instance-${connectionSubdomain}`,
  },
  instanceType: "t2.micro",
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  vpcSecurityGroupIds: [connectionEc2SecurityGroup.id],
  subnetId: subNet1, // Assign a subnet, otherwise a random one will be chosen which could be disconnected from the NLB
  ami: latestAmazonLinuxAmi.id,
  // Run Setup script on instance boot to create connection systemd service
  userDataReplaceOnChange: true,
  userData: pulumi.all([redisHost, redisPort]).apply(([host, port]) =>
    runDockerImageBashScript(
      connectionECRName,
      dockerImageTag,
      "quadratic-connection-development",
      {
        QUADRATIC_API_URI: quadraticApiUri,
      },
      true
    )
  ),
});

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("connection-nlb", {
  internal: false,
  loadBalancerType: "network",
  subnets: [subNet1, subNet2],
  enableCrossZoneLoadBalancing: true,
  securityGroups: [connectionNlbSecurityGroup.id],
});

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("connection-nlb-tg", {
  port: 80,
  protocol: "TCP",
  targetType: "instance",
  vpcId: vpcId,
});

// Attach the instance to the new Target Group
const targetGroupAttachment = new aws.lb.TargetGroupAttachment(
  "connection-attach-instance-tg",
  {
    targetId: instance.id,
    targetGroupArn: targetGroup.arn,
  }
);

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
