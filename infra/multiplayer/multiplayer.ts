import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { redisHost, redisPort } from "../shared/redis";
import {
  multiplayerEc2SecurityGroup,
  multiplayerNlbSecurityGroup,
} from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const multiplayerSubdomain = config.require("multiplayer-subdomain");
const quadraticApiUri = config.require("quadratic-api-uri");
const dockerImageTag = config.require("docker-image-tag");

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");
const instanceKeyName = config.require("ec2-instance-key-name");
const subNet1 = config.require("subnet1");
const subNet2 = config.require("subnet2");
const vpcId = config.require("vpc-id");
const instanceSize = config.require("multiplayer-instance-size");
const instanceAmi = config.require("multiplayer-instance-ami");
const pulumiAccessToken = config.require("pulumi-access-token");
const ecrRegistryUrl = config.require("ecr-registry-url");


const instance = new aws.ec2.Instance("multiplayer-instance", {
  tags: {
    Name: `multiplayer-instance-${multiplayerSubdomain}`,
  },
  instanceType: instanceSize,
  vpcSecurityGroupIds: [multiplayerEc2SecurityGroup.id],
  ami: instanceAmi,
  keyName: instanceKeyName,
  // Run Setup script on instance boot to create multiplayer systemd service
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
esc env open quadratic/quadratic-multiplayer-development --format dotenv > .env
sed -i 's/"//g' .env
echo PUBSUB_HOST=${host} >> .env
echo PUBSUB_PORT=${port} >> .env
echo QUADRATIC_API_URI=${quadraticApiUri} >> .env

echo 'Ensure AWS Cli is installed'
sudo yum install aws-cli -y

echo 'Logging into ECR'
aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin ${ecrRegistryUrl}

echo 'Pulling and running Docker image from ECR'
sudo docker pull ${ecrRegistryUrl}/quadratic-multiplayer-development:${dockerImageTag}
sudo docker run -d --restart always -p 80:80 --env-file .env ${ecrRegistryUrl}/quadratic-multiplayer-development:${dockerImageTag}`,
});

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("multiplayer-nlb", {
  internal: false,
  loadBalancerType: "network",
  subnets: [subNet1, subNet2],
  enableCrossZoneLoadBalancing: true,
  securityGroups: [multiplayerNlbSecurityGroup.id],
});

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("multiplayer-nlb-tg", {
  port: 80,
  protocol: "TCP",
  targetType: "instance",
  vpcId: vpcId,
});

// Attach the instance to the new Target Group
const targetGroupAttachment = new aws.lb.TargetGroupAttachment(
  "multiplayer-attach-instance-tg",
  {
    targetId: instance.id,
    targetGroupArn: targetGroup.arn,
  }
);

// Create NLB Listener for TLS on port 443
const nlbListener = new aws.lb.Listener("multiplayer-nlb-listener", {
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
const dnsRecord = new aws.route53.Record("multiplayer-r53-record", {
  zoneId: hostedZone.id,
  name: `${multiplayerSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  aliases: [
    {
      name: nlb.dnsName,
      zoneId: nlb.zoneId,
      evaluateTargetHealth: true,
    },
  ],
});

export const multiplayerInstanceDns = instance.publicDns;
export const multiplayerPublicDns = dnsRecord.name;
