import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";
const config = new pulumi.Config();

// Configuration from command line
const connectionSubdomain = config.require("connection-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");
const connectionECRName = config.require("connection-ecr-repo-name");

// Configuration from Pulumi ESC
const domain = config.require("domain");

const cluster = new aws.ecs.Cluster("connection-cluster");

// Create a Fargate service task that uses the image from the ECR repository
const appService = new awsx.ecs.FargateService("connection-fargate-service", {
  cluster: cluster.arn,
  taskDefinitionArgs: {
    container: {
      name: "app",
      image: `${connectionECRName}:${dockerImageTag}`,
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
  desiredCount: 1,
});

// // Export the URL of the service
// const nlb = appService.service.loadBalancers.apply((lb) => lb);

// // Get the hosted zone ID for domain
// const hostedZone = pulumi.output(
//   aws.route53.getZone(
//     {
//       name: domain,
//     },
//     { async: true }
//   )
// );

// // Create a Route 53 record pointing to the NLB
// let dnsRecord = "none"
// if (nlb !== undefined)
//     dnsRecord = new aws.route53.Record("multiplayer-r53-record", {
//     zoneId: hostedZone.id,
//     name: `${connectionSubdomain}.${domain}`, // subdomain you want to use
//     type: "A",
//     aliases: [
//         {
//         name: nlb.dnsName,
//         zoneId: nlb.zoneId,
//         evaluateTargetHealth: true,
//         },
//     ],
//     });

export const connectionPublicDns = "dnsRecord.name";
