import * as aws from "@pulumi/aws";

// Create a Security Group for the Files EC2 instance
export const filesEc2SecurityGroup = new aws.ec2.SecurityGroup("files-sg", {
  ingress: [
    // { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
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
      // { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
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
