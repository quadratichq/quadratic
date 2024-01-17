import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { redisHost, redisPort } from "../shared/redis";
const config = new pulumi.Config();

// Configuration from command line
const filesSubdomain = config.require("files-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");

// Configuration from Pulumi ESC
const domain = config.require("domain");
const instanceSize = config.require("files-instance-size");
const ecrRegistryUrl = config.require("ecr-registry-url");
const pulumiAccessToken = config.requireSecret("pulumi-access-token");

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
    role: role,
  }
);

// Create a Security Group for the EC2 instance
export const filesEc2SecurityGroup = new aws.ec2.SecurityGroup("files-sg", {
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
  iamInstanceProfile: instanceProfile,
  vpcSecurityGroupIds: [filesEc2SecurityGroup.id],
  ami: latestAmazonLinuxAmi.id,
  // Run Setup script on instance boot to create multiplayer systemd service
  userData: `#!/bin/bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# Install the Pulumi ESC CLI
curl -fsSL https://get.pulumi.com/esc/install.sh | sh
export PATH=$PATH:/home/ec2-user/.pulumi/bin
export PULUMI_ACCESS_TOKEN=${pulumiAccessToken}
esc login

# Project ENV Vars
esc env open quadratic/quadratic-files-development --format dotenv > .env

# Strip quotes from .env file
sed -i 's/"//g' .env
echo PUBSUB_HOST=${redisHost} >> .env
echo PUBSUB_PORT=${redisPort} >> .env
echo QUADRATIC_API_URI=${quadraticApiUri} >> .env

# Ensure the AWS CLI is installed
sudo yum install aws-cli -y

# Log in to ECR
aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin ${ecrRegistryUrl}

# Pull and run the Docker image from ECR
sudo docker pull ${ecrRegistryUrl}/quadratic-files-development:${dockerImageTag}
sudo docker run -d -p 80:80 --env-file .env ${ecrRegistryUrl}/quadratic-files-development:${dockerImageTag}`,
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
