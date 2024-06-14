import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";
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

////////////////////////////////////////////////////////

// Create a security group to allow outbound traffic
const securityGroup = new aws.ec2.SecurityGroup("service-sg", {
  vpcId: vpcId,
  egress: [
    {
      protocol: "-1", // All protocols
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"], // Allow all outbound traffic
    },
  ],
});

// Create an ECS Fargate cluster.
const cluster = new awsx.classic.ecs.Cluster("cluster");

// Define the Networking for our service.
const nlb = new awsx.classic.lb.NetworkLoadBalancer("connection-nlb", {
  subnets: [subNet1, subNet2],
});

const targetGroup = nlb.createTargetGroup("connection-target-group", {
  port: 80,
  protocol: "TCP",
  targetType: "ip",
  healthCheck: {
    path: "/health",
    interval: 30,
    healthyThreshold: 2,
    unhealthyThreshold: 2,
  },
});

const listener = nlb.createListener("connection-listener", {
  port: 443,
  protocol: "TLS",
  certificateArn: certificateArn,
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.targetGroup.arn,
    },
  ],
});

// Create a repository for container images.
const repo = new awsx.ecr.Repository("connection-repo", {
  forceDelete: true,
});

// Build and publish a Docker image to a private ECR registry.
const img = new awsx.ecr.Image("connection-image", {
  repositoryUrl: repo.url,
  context: "../",
  dockerfile: "../quadratic-connection/Dockerfile",
});

// Create a Fargate service task that can scale out.
const appService = new awsx.classic.ecs.FargateService("app-svc", {
  cluster,
  taskDefinitionArgs: {
    container: {
      image: img.imageUri,
      cpu: 102 /*10% of 1024*/,
      memory: 50 /*MB*/,
      portMappings: [targetGroup],
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
  desiredCount: 1,
  securityGroups: [securityGroup.id],
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
      name: nlb.loadBalancer.dnsName,
      zoneId: nlb.loadBalancer.zoneId,
      evaluateTargetHealth: true,
    },
  ],
});

export const connectionPublicDns = dnsRecord.name;
