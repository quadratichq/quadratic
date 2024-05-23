import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";
import { connectionNlbSecurityGroup } from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const connectionSubdomain = config.require("connection-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");
const connectionECRName = config.require("connection-ecr-repo-name");
const ecrRegistryUrl = config.require("ecr-registry-url");

// Configuration from Pulumi ESC
const domain = config.require("domain");
const certificateArn = config.require("certificate-arn");
const subNet1 = config.require("subnet1");
const subNet2 = config.require("subnet2");
const vpcId = config.require("vpc-id");

const cluster = new aws.ecs.Cluster("connection-cluster");

// Create a new Application Load Balancer
const alb = new aws.lb.LoadBalancer("connection-alb", {
  internal: false,
  loadBalancerType: "application",
  subnets: [subNet1, subNet2],
  enableCrossZoneLoadBalancing: true,
  securityGroups: [connectionNlbSecurityGroup.id],
});

// Create a new Target Group
const targetGroup = new aws.lb.TargetGroup("connection-nlb-tg", {
  port: 80,
  protocol: "TCP",
  targetType: "ip",
  vpcId: vpcId,
});

// Listen to HTTP traffic on port 80
const listener = new aws.lb.Listener("connection-alb-listener", {
  tags: {
    Name: `connection-nlb-${connectionSubdomain}`,
  },
  loadBalancerArn: alb.arn,
  port: 443,
  protocol: "HTTPS",
  certificateArn: certificateArn, // Attach the SSL certificate
  sslPolicy: "ELBSecurityPolicy-2016-08", // Choose an appropriate SSL policy
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.arn,
    },
  ],
});

// Create a Fargate service task that uses the image from the ECR repository
const appService = new awsx.ecs.FargateService("connection-fargate-service", {
  cluster: cluster.arn,
  taskDefinitionArgs: {
    container: {
      name: "app",
      image: `${ecrRegistryUrl}/${connectionECRName}:${dockerImageTag}`,
      memory: 512,
      cpu: 2,
      portMappings: [{ hostPort: 80 }],
      environment: [
        // TODO: Pull these from Pulumi ESC
        { name: "QUADRATIC_API_URI", value: quadraticApiUri },
        { name: "HOST", value: "0.0.0.0" },
        { name: "PORT", value: "80" },
        { name: "ENVIRONMENT", value: "docker" },
        {
          name: "AUTH0_JWKS_URI",
          value: "https://dev-nje7dw8s.us.auth0.com/.well-known/jwks.json",
        },
        { name: "M2M_AUTH_TOKEN", value: "M2M_AUTH_TOKEN" },
      ],
    },
  },
  networkConfiguration: {
    assignPublicIp: true,
    subnets: [subNet1, subNet2],
    securityGroups: [connectionNlbSecurityGroup.id],
  },
  loadBalancers: [
    {
      targetGroupArn: targetGroup.arn,
      containerName: "app",
      containerPort: 80,
    },
  ],
  //   assignPublicIp: true,
  desiredCount: 1,
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
const dnsRecord = new aws.route53.Record("connection-r53-record", {
  zoneId: hostedZone.id,
  name: `${connectionSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  aliases: [
    {
      name: alb.dnsName,
      zoneId: alb.zoneId,
      evaluateTargetHealth: true,
    },
  ],
});

export const connectionPublicDns = dnsRecord.name;
