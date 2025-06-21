import * as aws from "@pulumi/aws";

import { isPreviewEnvironment } from "../helpers/isPreviewEnvironment";

// Create a new VPC
export const apiVPC = new aws.ec2.Vpc("api-vpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsSupport: true,
  enableDnsHostnames: true,
  tags: { Name: "api-vpc" },
});

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("api-igw", {
  vpcId: apiVPC.id,
  tags: { Name: "api-igw" },
});

// Create Elastic IPs
export const apiEip1 = new aws.ec2.Eip("api-nat-eip-1", {
  domain: "vpc",
});

export const apiEip2 = new aws.ec2.Eip("api-nat-eip-2", {
  domain: "vpc",
});

// Create public subnets
export const apiPublicSubnet1 = new aws.ec2.Subnet("api-public-subnet-1", {
  vpcId: apiVPC.id,
  cidrBlock: "10.0.1.0/24",
  availabilityZone: "us-west-2a",
  mapPublicIpOnLaunch: true,
  tags: { Name: "api-public-subnet-1" },
});

export const apiPublicSubnet2 = new aws.ec2.Subnet("api-public-subnet-2", {
  vpcId: apiVPC.id,
  cidrBlock: "10.0.2.0/24",
  availabilityZone: "us-west-2b",
  mapPublicIpOnLaunch: true,
  tags: { Name: "api-public-subnet-2" },
});

// Create a NAT Gateway in each public subnet
const natGateway1 = new aws.ec2.NatGateway("api-nat-gateway-1", {
  allocationId: apiEip1.id,
  subnetId: apiPublicSubnet1.id,
  tags: { Name: "api-nat-gateway-1" },
});

const natGateway2 = new aws.ec2.NatGateway("api-nat-gateway-2", {
  allocationId: apiEip2.id,
  subnetId: apiPublicSubnet2.id,
  tags: { Name: "api-nat-gateway-2" },
});

// Create private subnets
export const apiPrivateSubnet1 = new aws.ec2.Subnet("api-private-subnet-1", {
  vpcId: apiVPC.id,
  cidrBlock: "10.0.3.0/24",
  availabilityZone: "us-west-2a",
  tags: { Name: "api-private-subnet-1" },
});

export const apiPrivateSubnet2 = new aws.ec2.Subnet("api-private-subnet-2", {
  vpcId: apiVPC.id,
  cidrBlock: "10.0.4.0/24",
  availabilityZone: "us-west-2b",
  tags: { Name: "api-private-subnet-2" },
});

// Create route tables
const publicRouteTable = new aws.ec2.RouteTable("api-public-route-table", {
  vpcId: apiVPC.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    },
  ],
  tags: { Name: "api-public-route-table" },
});

const privateRouteTable1 = new aws.ec2.RouteTable("api-private-route-table-1", {
  vpcId: apiVPC.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway1.id,
    },
  ],
  tags: { Name: "api-private-route-table-1" },
});

const privateRouteTable2 = new aws.ec2.RouteTable("api-private-route-table-2", {
  vpcId: apiVPC.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway2.id,
    },
  ],
  tags: { Name: "api-private-route-table-2" },
});

// Associate subnets with route tables
new aws.ec2.RouteTableAssociation("api-public-route-table-association-1", {
  subnetId: apiPublicSubnet1.id,
  routeTableId: publicRouteTable.id,
});

new aws.ec2.RouteTableAssociation("api-public-route-table-association-2", {
  subnetId: apiPublicSubnet2.id,
  routeTableId: publicRouteTable.id,
});

new aws.ec2.RouteTableAssociation("api-private-route-table-association-1", {
  subnetId: apiPrivateSubnet1.id,
  routeTableId: privateRouteTable1.id,
});

new aws.ec2.RouteTableAssociation("api-private-route-table-association-2", {
  subnetId: apiPrivateSubnet2.id,
  routeTableId: privateRouteTable2.id,
});

// Create a Security Group for the Api ALB
export const apiAlbSecurityGroup = new aws.ec2.SecurityGroup(
  "api-alb-security-group",
  {
    vpcId: apiVPC.id,
    ingress: [
      {
        description: "HTTPS from anywhere",
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        cidrBlocks: ["0.0.0.0/0"],
      },
      {
        description: "HTTP from anywhere (for redirect)",
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
    tags: { Name: "api-alb-security-group" },
  },
);

// Create a Security Group for the Api EC2 instance
export const apiEc2SecurityGroup = new aws.ec2.SecurityGroup("api-sg-1", {
  vpcId: apiVPC.id,
  ingress: [
    {
      description: "HTTP from ALB",
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      securityGroups: [apiAlbSecurityGroup.id],
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
  tags: { Name: "api-ec2-security-group" },
});

if (isPreviewEnvironment)
  new aws.ec2.SecurityGroupRule(`api-ssh-ingress-rule`, {
    type: "ingress",
    fromPort: 22,
    toPort: 22,
    protocol: "tcp",
    cidrBlocks: ["0.0.0.0/0"],
    securityGroupId: apiEc2SecurityGroup.id,
  });
