import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
const config = new pulumi.Config();

// Configuration from command line
const filesSubdomain = config.require("files-subdomain");
const dockerImageTag = config.require("docker-image-tag");

// Configuration from Pulumi ESC
const domain = config.require("domain");
const instanceSize = config.require("files-instance-size");
const ecrRegistryUrl = config.require("ecr-registry-url");

// Create an IAM Role for EC2
const role = new aws.iam.Role("files-ec2-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "ec2.amazonaws.com",
        },
      },
    ],
  }),
});

// Attach the AmazonEC2ContainerRegistryReadOnly policy
const policyAttachment = new aws.iam.RolePolicyAttachment(
  "files-ec2-role-policy-attachment",
  {
    role: role,
    policyArn: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
  }
);

// Create an Instance Profile for EC2
const instanceProfile = new aws.iam.InstanceProfile(
  "files-ec2-instance-profile",
  {
    role: role.name,
  }
);

// Create a Security Group for the EC2 instance
const ec2SecurityGroup = new aws.ec2.SecurityGroup("files-sg", {
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
    },
    {
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
});

const instance = new aws.ec2.Instance("files-instance", {
  tags: {
    Name: `files-instance-${filesSubdomain}`,
  },
  instanceType: instanceSize,
  iamInstanceProfile: instanceProfile.name,
  vpcSecurityGroupIds: [ec2SecurityGroup.id],
  ami: latestAmazonLinuxAmi.id,
  // Run Setup script on instance boot to create multiplayer systemd service
  userData: `#!/bin/bash
sudo yum update -y
sudo amazon-linux-extras install docker -y
sudo systemctl start docker
sudo systemctl enable docker

# Ensure the AWS CLI is installed
sudo yum install aws-cli -y

# Log in to ECR
$(aws ecr get-login --region us-west-2 --no-include-email)

# Pull and run the Docker image from ECR
docker pull ${ecrRegistryUrl}/quadratic-files-development:${dockerImageTag}
docker run -d -p 80:80 ${ecrRegistryUrl}/quadratic-files-development:${dockerImageTag}`,
});

// // Get the hosted zone ID for domain
// const hostedZone = pulumi.output(
//   aws.route53.getZone(
//     {
//       name: domain,
//     },
//     { async: true }
//   )
// );

// // Create a Route 53 record pointing to EC2 instance
// const dnsRecord = new aws.route53.Record("multiplayer-r53-record", {
//   zoneId: hostedZone.id,
//   name: `${multiplayerSubdomain}.${domain}`, // subdomain you want to use
//   type: "A",
//   aliases: [
//     {
//       name: nlb.dnsName,
//       zoneId: nlb.zoneId,
//       evaluateTargetHealth: true,
//     },
//   ],
// });

export const filesPublicDns = instance.publicDns;
