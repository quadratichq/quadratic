import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";

const size = "t2.micro";

// Define the ARN of your ACM certificate
const certificateArn =
  "arn:aws:acm:us-west-2:896845383385:certificate/e34f26e1-cb0e-49d1-b6da-5a4644cb3403";

const ami = pulumi.output(
  aws.ec2.getAmi({
    owners: ["099720109477"], // Canonical ID
    mostRecent: true,
    filters: [
      {
        name: "name",
        values: ["ubuntu/images/hvm-ssd/ubuntu-*-amd64-server-*"],
      },
      { name: "architecture", values: ["x86_64"] },
      { name: "root-device-type", values: ["ebs"] },
    ],
  })
);

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
const userData = fs.readFileSync(
  "scripts/setup-multiplayer-service.sh",
  "utf-8"
);
const instance = new aws.ec2.Instance("multiplayer-instance", {
  instanceType: size,
  vpcSecurityGroupIds: [group.id],
  ami: ami.id,
  keyName: "test2",
  // Run Setup script on instance boot
  userData: userData,
});

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("multiplayer-nlb", {
  internal: false,
  loadBalancerType: "network",
  subnets: ["subnet-0ae50871c8ec4e68f", "subnet-0c6f318928373a253"],
  enableCrossZoneLoadBalancing: true,
});

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("multiplayer-nlb-tg", {
  port: 80,
  protocol: "TCP",
  targetType: "instance",
  vpcId: "vpc-035fff213c528dbe5",
});

// Attach the instance to the new Target Group
const targetGroupAttachment = new aws.lb.TargetGroupAttachment(
  "attachInstanceToNewGroup",
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
      name: "quadratic-preview.com",
    },
    { async: true }
  )
);

// Create a Route 53 record pointing to the NLB
const dnsRecord = new aws.route53.Record("multiplayer-r53-record", {
  zoneId: hostedZone.id,
  name: "wss-2.quadratic-preview.com", // subdomain you want to use
  type: "A", // or "CNAME" if preferred
  aliases: [
    {
      name: nlb.dnsName,
      zoneId: nlb.zoneId,
      evaluateTargetHealth: true,
    },
  ],
});

export const publicIp = instance.publicIp;
export const publicDns = instance.publicDns;
export const loadBalancerDns = nlb.dnsName;
