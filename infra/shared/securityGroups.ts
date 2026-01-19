import * as aws from "@pulumi/aws";

import { apiVPC } from "../api/api_network";
import { cloudControllerEc2SecurityGroup } from "../cloud-controller/cloud_controller_network";

// api-vpc CIDR block (defined in api_network.ts)
const API_VPC_CIDR = "10.0.0.0/16";

// Create a Security Group for the Files EC2 instance
export const filesEc2SecurityGroup = new aws.ec2.SecurityGroup("files-sg", {
  vpcId: apiVPC.id,
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
  tags: { Name: "files-ec2-security-group" },
});

// Create a Security Group for the Multiplayer NLB
export const multiplayerNlbSecurityGroup = new aws.ec2.SecurityGroup(
  "nlb-security-group",
  {
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

// Create a Security Group for the Multiplayer EC2 instance
export const multiplayerEc2SecurityGroup = new aws.ec2.SecurityGroup(
  "multiplayer-sg",
  {
    ingress: [
      {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        securityGroups: [multiplayerNlbSecurityGroup.id],
      },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
  },
);

// Redis Security Group
// Note: Files service is in api-vpc (10.0.0.0/16) while Redis is in the shared VPC.
// We use CIDR block for files since security groups can't be referenced across VPCs.
// VPC peering is configured in vpc_peering.ts to enable connectivity.
export const redisSecurityGroup = new aws.ec2.SecurityGroup("redis-sg", {
  ingress: [
    {
      description: "Allow cloud controller to access Redis",
      protocol: "tcp",
      fromPort: 6379,
      toPort: 6379,
      securityGroups: [cloudControllerEc2SecurityGroup.id],
    },
    {
      description: "Allow multiplayer to access Redis",
      protocol: "tcp",
      fromPort: 6379,
      toPort: 6379,
      securityGroups: [multiplayerEc2SecurityGroup.id],
    },
    {
      description: "Allow files service (in api-vpc) to access Redis via VPC peering",
      protocol: "tcp",
      fromPort: 6379,
      toPort: 6379,
      cidrBlocks: [API_VPC_CIDR],
    },
  ],
});
