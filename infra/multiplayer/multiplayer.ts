import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
const config = new pulumi.Config();

// Configuration from command line
const multiplayerSubdomain = config.get("subdomain") || "wss";
const quadraticApiUri =
  config.get("quadratic-api-uri") || "https://api.quadratichq.com";

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");
const instanceKeyName = config.require("ec2-instance-key-name");
const subNet1 = config.require("subnet1");
const subNet2 = config.require("subnet2");
const vpcId = config.require("vpc-id");
const dataDogEnv = config.require("data-dog-env");
const dataDogApiKey = config.require("data-dog-api-key");
const instanceSize = config.require("multiplayer-instance-size");
const instanceAmi = config.require("multiplayer-instance-ami");
const awsS3AccessKey = config.require("multiplayer-aws-s3-access-key-id");
const awsS3Secret = config.require("multiplayer-aws-s3-secret-access-key");

// Create a Security Group for the NLB
const nlbSecurityGroup = new aws.ec2.SecurityGroup("nlb-security-group", {
  ingress: [
    { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
});

// Create a Security Group for the EC2 instance
const ec2SecurityGroup = new aws.ec2.SecurityGroup("multiplayer-sg", {
  ingress: [
    { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      securityGroups: [nlbSecurityGroup.id],
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
});

// Redis Security Group
const redisSecurityGroup = new aws.ec2.SecurityGroup("redis-sg", {
  ingress: [
    {
      protocol: "tcp",
      fromPort: 6379,
      toPort: 6379,
      securityGroups: [ec2SecurityGroup.id],
    },
  ],
});

// Create a Redis ElastiCache cluster
const redisCluster = new aws.elasticache.Cluster("multiplayer-redis-cluster", {
  engine: "redis",
  engineVersion: "7.1",
  nodeType: "cache.t4g.micro",
  numCacheNodes: 1,
  securityGroupIds: [redisSecurityGroup.id],
});

const redisConnectionString = `${redisCluster.cacheNodes.apply(
  (nodes) => nodes[0].address
)}:${redisCluster.port}`;

// Read the content of the Bash script
let setupMultiplayerService = fs.readFileSync(
  "multiplayer/setup-multiplayer-service.sh",
  "utf-8"
);
// Set the environment variables in the Bash script
setupMultiplayerService = setupMultiplayerService.replace(
  "{{DD_ENV}}",
  dataDogEnv
);
setupMultiplayerService = setupMultiplayerService.replace(
  "{{DD_API_KEY}}",
  dataDogApiKey
);
setupMultiplayerService = setupMultiplayerService.replace(
  "{{QUADRATIC_API_URI}}",
  quadraticApiUri
);
setupMultiplayerService = setupMultiplayerService.replace(
  "{{MULTIPLAYER_AWS_S3_ACCESS_KEY_ID}}",
  awsS3AccessKey
);
setupMultiplayerService = setupMultiplayerService.replace(
  "{{MULTIPLAYER_AWS_S3_SECRET_ACCESS_KEY}}",
  awsS3Secret
);
setupMultiplayerService = setupMultiplayerService.replace(
  "{{AWS_REDIS_CONNECTION_STRING}}",
  redisConnectionString
);
const instance = new aws.ec2.Instance("multiplayer-instance", {
  tags: {
    Name: `multiplayer-instance-${multiplayerSubdomain}`,
  },
  instanceType: instanceSize,
  vpcSecurityGroupIds: [ec2SecurityGroup.id],
  ami: instanceAmi,
  keyName: instanceKeyName,
  // Run Setup script on instance boot to create multiplayer systemd service
  userData: setupMultiplayerService,
});

// Create a new Network Load Balancer
const nlb = new aws.lb.LoadBalancer("multiplayer-nlb", {
  internal: false,
  loadBalancerType: "network",
  subnets: [subNet1, subNet2],
  enableCrossZoneLoadBalancing: true,
  securityGroups: [nlbSecurityGroup.id],
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
