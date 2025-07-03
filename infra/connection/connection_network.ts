import * as aws from "@pulumi/aws";

// Create a new VPC
export const connectionVPC = new aws.ec2.Vpc("connection-vpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsSupport: true,
  enableDnsHostnames: true,
  tags: { Name: "connection-vpc" },
});

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("connection-igw", {
  vpcId: connectionVPC.id,
  tags: { Name: "connection-igw" },
});

// Create Elastic IPs
export const connectionEip1 = new aws.ec2.Eip("nat-eip-1", {
  domain: "vpc",
});

export const connectionEip2 = new aws.ec2.Eip("nat-eip-2", {
  domain: "vpc",
});

// Create public subnets
export const connectionPublicSubnet1 = new aws.ec2.Subnet(
  "connection-public-subnet-1",
  {
    vpcId: connectionVPC.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: "us-west-2a",
    mapPublicIpOnLaunch: true,
    tags: { Name: "connection-public-subnet-1" },
  },
);

export const connectionPublicSubnet2 = new aws.ec2.Subnet(
  "connection-public-subnet-2",
  {
    vpcId: connectionVPC.id,
    cidrBlock: "10.0.2.0/24",
    availabilityZone: "us-west-2b",
    mapPublicIpOnLaunch: true,
    tags: { Name: "connection-public-subnet-2" },
  },
);

// Create a NAT Gateway in each public subnet
const natGateway1 = new aws.ec2.NatGateway("nat-gateway-1", {
  allocationId: connectionEip1.id,
  subnetId: connectionPublicSubnet1.id,
  tags: { Name: "nat-gateway-1" },
});

const natGateway2 = new aws.ec2.NatGateway("nat-gateway-2", {
  allocationId: connectionEip2.id,
  subnetId: connectionPublicSubnet2.id,
  tags: { Name: "nat-gateway-2" },
});
// Create private subnets
export const connectionPrivateSubnet1 = new aws.ec2.Subnet(
  "connection-private-subnet-1",
  {
    vpcId: connectionVPC.id,
    cidrBlock: "10.0.3.0/24",
    availabilityZone: "us-west-2a",
    tags: { Name: "connection-private-subnet-1" },
  },
);

export const connectionPrivateSubnet2 = new aws.ec2.Subnet(
  "connection-private-subnet-2",
  {
    vpcId: connectionVPC.id,
    cidrBlock: "10.0.4.0/24",
    availabilityZone: "us-west-2b",
    tags: { Name: "connection-private-subnet-2" },
  },
);

// Create route tables
const publicRouteTable = new aws.ec2.RouteTable("public-route-table", {
  vpcId: connectionVPC.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    },
  ],
  tags: { Name: "public-route-table" },
});

const privateRouteTable1 = new aws.ec2.RouteTable("private-route-table-1", {
  vpcId: connectionVPC.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway1.id,
    },
  ],
  tags: { Name: "private-route-table-1" },
});

const privateRouteTable2 = new aws.ec2.RouteTable("private-route-table-2", {
  vpcId: connectionVPC.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway2.id,
    },
  ],
  tags: { Name: "private-route-table-2" },
});

// Associate subnets with route tables
new aws.ec2.RouteTableAssociation("public-route-table-association-1", {
  subnetId: connectionPublicSubnet1.id,
  routeTableId: publicRouteTable.id,
});

new aws.ec2.RouteTableAssociation("public-route-table-association-2", {
  subnetId: connectionPublicSubnet2.id,
  routeTableId: publicRouteTable.id,
});

new aws.ec2.RouteTableAssociation("private-route-table-association-1", {
  subnetId: connectionPrivateSubnet1.id,
  routeTableId: privateRouteTable1.id,
});

new aws.ec2.RouteTableAssociation("private-route-table-association-2", {
  subnetId: connectionPrivateSubnet2.id,
  routeTableId: privateRouteTable2.id,
});

// Create a Security Group for the Connection NLB
export const connectionNlbSecurityGroup = new aws.ec2.SecurityGroup(
  "connection-nlb-security-group-1",
  {
    vpcId: connectionVPC.id,
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
  },
);

// Create a Security Group for the Connection EC2 instance
export const connectionEc2SecurityGroup = new aws.ec2.SecurityGroup(
  "connection-sg-1",
  {
    vpcId: connectionVPC.id,
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
  },
);
