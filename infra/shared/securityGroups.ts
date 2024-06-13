import * as aws from "@pulumi/aws";
import { isPreviewEnvironment } from "../helpers/isPreviewEnvironment";

// Create a Security Group for the Files EC2 instance
export const filesEc2SecurityGroup = new aws.ec2.SecurityGroup("files-sg", {
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
  }
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
  }
);

// Redis Security Group
export const redisSecurityGroup = new aws.ec2.SecurityGroup("redis-sg", {
  ingress: [
    {
      protocol: "tcp",
      fromPort: 6379,
      toPort: 6379,
      securityGroups: [
        filesEc2SecurityGroup.id,
        multiplayerEc2SecurityGroup.id,
      ],
    },
  ],
});

// Create a Security Group for the Connection NLB
export const connectionNlbSecurityGroup = new aws.ec2.SecurityGroup(
  "connection-nlb-security-group",
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
  }
);

// Create a Security Group for the Multiplayer EC2 instance
export const connectionEc2SecurityGroup = new aws.ec2.SecurityGroup(
  "connection-sg",
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
  }
);

// Allow SSH traffic to the Preview Instances
if (isPreviewEnvironment) {
  new aws.ec2.SecurityGroupRule(`files-ssh-ingress-rule`, {
    type: "ingress",
    fromPort: 22,
    toPort: 22,
    protocol: "tcp",
    cidrBlocks: ["0.0.0.0/0"],
    securityGroupId: filesEc2SecurityGroup.id,
  });
  new aws.ec2.SecurityGroupRule(`multiplayer-ssh-ingress-rule`, {
    type: "ingress",
    fromPort: 22,
    toPort: 22,
    protocol: "tcp",
    cidrBlocks: ["0.0.0.0/0"],
    securityGroupId: multiplayerEc2SecurityGroup.id,
  });
}
