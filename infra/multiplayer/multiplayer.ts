import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
import { redisHost, redisPort } from "../shared/redis";
import {
  multiplayerEc2SecurityGroup,
  multiplayerNlbSecurityGroup,
} from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const multiplayerSubdomain = config.require("multiplayer-subdomain");
const quadraticApiUri = config.require("quadratic-api-uri");

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
const pulumiAccessToken = config.require("pulumi-access-token");

// Read the content of the Bash script
let setupMultiplayerService = fs.readFileSync(
  "multiplayer/setup-multiplayer-service.sh",
  "utf-8"
);
// Set the environment variables in the Bash script
setupMultiplayerService = setupMultiplayerService
  .replace("{{DD_ENV}}", dataDogEnv)
  .replace("{{DD_API_KEY}}", dataDogApiKey)
  .replace("{{QUADRATIC_API_URI}}", quadraticApiUri)
  .replace("{{MULTIPLAYER_AWS_S3_ACCESS_KEY_ID}}", awsS3AccessKey)
  .replace("{{MULTIPLAYER_AWS_S3_SECRET_ACCESS_KEY}}", awsS3Secret)
  .replace("{{pulumiAccessToken}}", pulumiAccessToken);
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
  userData: pulumi
    .all([redisHost, redisPort])
    .apply(([host, port]) =>
      setupMultiplayerService
        .replace("{{PUBSUB_HOST}}", host)
        .replace("{{PUBSUB_PORT}}", port.toString())
    ),
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
