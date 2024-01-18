import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
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

const instance = new aws.ec2.Instance("files-instance", {
  tags: {
    Name: `files-instance-${filesSubdomain}`,
  },
  instanceType: instanceSize,
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  vpcSecurityGroupIds: [filesEc2SecurityGroup.id],
  ami: latestAmazonLinuxAmi.id,
  userDataReplaceOnChange: true, // TODO: remove this
  userData: pulumi.all([redisHost, redisPort]).apply(
    ([host, port]) => `#!/bin/bash
echo 'Installing Docker'
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

echo 'Installing Pulumi ESC CLI'
curl -fsSL https://get.pulumi.com/esc/install.sh | sh
export PATH=$PATH:/.pulumi/bin
export PULUMI_ACCESS_TOKEN=${pulumiAccessToken}
esc login

echo 'Setting ENV Vars'
esc env open quadratic/quadratic-files-development --format dotenv > .env
sed -i 's/"//g' .env
echo PUBSUB_HOST=${host} >> .env
echo PUBSUB_PORT=${port} >> .env
echo QUADRATIC_API_URI=${quadraticApiUri} >> .env

echo 'Ensure AWS Cli is installed'
sudo yum install aws-cli -y

echo 'Logging into ECR'
aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin ${ecrRegistryUrl}

echo 'Pulling and running Docker image from ECR'
sudo docker pull ${ecrRegistryUrl}/quadratic-files-development:${dockerImageTag}
sudo docker run -d --restart always -p 80:80 --env-file .env ${ecrRegistryUrl}/quadratic-files-development:${dockerImageTag}`
  ),
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
//   name: `${filesSubdomain}.${domain}`, // subdomain you want to use
//   type: "A",
//   aliases: [
//     {
//       name: instance.arn,
//       zoneId: instance.availabilityZone.apply((az) => az),
//       evaluateTargetHealth: true,
//     },
//   ],
// });

export const filesPublicDns = instance.publicDns;
