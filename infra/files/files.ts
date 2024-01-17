import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { redisHost, redisPort } from "../shared/redis";
import { filesEc2SecurityGroup } from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const filesSubdomain = config.require("files-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");

// Configuration from Pulumi ESC
const domain = config.require("domain");
const instanceSize = config.require("files-instance-size");
const ecrRegistryUrl = config.require("ecr-registry-url");
const pulumiAccessToken = config.require("pulumi-access-token");

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

// Configuration from other files
let deployFilesService = fs
  .readFileSync("files/deploy-files-service.sh", "utf-8")
  .replace("${pulumiAccessToken}", pulumiAccessToken)
  .replace("${ecrRegistryUrl}", ecrRegistryUrl)
  .replace("${dockerImageTag}", dockerImageTag)
  .replace("${quadraticApiUri}", quadraticApiUri)
  .replace("${redisHost}", `${redisHost}`)
  .replace("${redisPort}", `${redisPort}`);

const instance = new aws.ec2.Instance("files-instance", {
  tags: {
    Name: `files-instance-${filesSubdomain}`,
  },
  instanceType: instanceSize,
  iamInstanceProfile: instanceProfile,
  vpcSecurityGroupIds: [filesEc2SecurityGroup.id],
  ami: latestAmazonLinuxAmi.id,
  userData: deployFilesService,
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
