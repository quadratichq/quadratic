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

// Allocate Elastic IPs for the NAT Gateways
const eip1 = new aws.ec2.Eip("nat-eip-1");
const eip2 = new aws.ec2.Eip("nat-eip-2");

// Create NAT Gateways in each public subnet
const natGateway1 = new aws.ec2.NatGateway("nat-gateway-1", {
  allocationId: eip1.id,
  subnetId: subNet1,
});

const natGateway2 = new aws.ec2.NatGateway("nat-gateway-2", {
  allocationId: eip2.id,
  subnetId: subNet2,
});

// Create route tables for private subnets
const privateRouteTable1 = new aws.ec2.RouteTable("private-route-table-1", {
  vpcId: vpcId,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway1.id,
    },
  ],
});

const privateRouteTable2 = new aws.ec2.RouteTable("private-route-table-2", {
  vpcId: vpcId,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway2.id,
    },
  ],
});

// Associate the private subnets with the route tables
new aws.ec2.RouteTableAssociation("private-subnet-1-association", {
  subnetId: subNet1,
  routeTableId: privateRouteTable1.id,
});

new aws.ec2.RouteTableAssociation("private-subnet-2-association", {
  subnetId: subNet2,
  routeTableId: privateRouteTable2.id,
});

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
// const img = new awsx.ecr.Image("connection-image", {
//   repositoryUrl: repo.url,
//   context: "../",
//   dockerfile: "../quadratic-connection/Dockerfile",
// });

// Create a Fargate service task that can scale out.
const appService = new awsx.classic.ecs.FargateService("app-svc", {
  cluster,
  taskDefinitionArgs: {
    container: {
      image: `${ecrRegistryUrl}/${connectionECRName}:${dockerImageTag}`,
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
        { name: "STATIC_IPS", value: `${eip1.publicIp},${eip2.publicIp}` },
      ],
    },
  },
  desiredCount: 1,
  securityGroups: [securityGroup.id],
  subnets: [subNet1, subNet2], // Ensure tasks are launched in subnets with NAT Gateways
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
