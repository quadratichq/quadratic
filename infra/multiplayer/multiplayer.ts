import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
const config = new pulumi.Config();

// Configuration
const domain = config.get("domain") || "quadratic-preview.com"; // ex quadratic-preview.com
const multiplayerSubdomain = config.get("subdomain") || "wss-2"; // ex ws
const certificateArn =
  config.get("certificate-arn") ||
  "arn:aws:acm:us-west-2:896845383385:certificate/00300c0e-4243-4296-87c1-83e86bb73a1f"; // ARN of the SSL certificate for quadratic-preview.com (us-west-2)
const instanceSize = config.get("instance-size") || "t2.micro";
const instanceKeyName = config.get("instance-key-name") || "test2";
const instanceAmi = config.get("instance-ami") || "ami-0efcece6bed30fd98"; // ubuntu 20.04 LTS
const subNet1 = config.get("subnet1") || "subnet-0ae50871c8ec4e68f";
const subNet2 = config.get("subnet2") || "subnet-0c6f318928373a253";
const vpcId = config.get("vpc-id") || "vpc-035fff213c528dbe5";

// const ami = pulumi.output(
//   aws.ec2.getAmi({
//     owners: ["099720109477"], // Canonical ID
//     mostRecent: true,
//     filters: [
//       {
//         name: "name",
//         values: ["ubuntu/images/hvm-ssd/ubuntu-*-amd64-server-*"],
//       },
//       { name: "architecture", values: ["x86_64"] },
//       { name: "root-device-type", values: ["ebs"] },
//     ],
//   })
// );

const group = new aws.ec2.SecurityGroup("multiplayer-sc", {
  ingress: [
    { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
    { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
  ],
  egress: [
    { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
    { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
  ],
});

// Read the content of the Bash script
const setupMultiplayerService = fs.readFileSync(
  "multiplayer/setup-multiplayer-service.sh",
  "utf-8"
);
const instance = new aws.ec2.Instance("multiplayer-instance", {
  tags: {
    Name: `multiplayer-instance-${multiplayerSubdomain}`,
  },
  instanceType: instanceSize,
  vpcSecurityGroupIds: [group.id],
  ami: instanceAmi,
  keyName: instanceKeyName,
  // Run Setup script on instance boot
  userData: setupMultiplayerService,
});

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("multiplayer-nlb", {
  internal: false,
  loadBalancerType: "network",
  subnets: [subNet1, subNet2],
  enableCrossZoneLoadBalancing: true,
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

// Get the hosted zone ID for quadratic-preview.com
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
