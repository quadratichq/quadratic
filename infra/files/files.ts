import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import { redisHost, redisPort } from "../shared/redis";
import { filesEc2SecurityGroup } from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const filesSubdomain = config.require("files-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const quadraticApiUri = config.require("quadratic-api-uri");
const filesECRName = config.require("files-ecr-repo-name");
const filesPulumiEscEnvironmentName = config.require(
  "files-pulumi-esc-environment-name"
);

// Configuration from Pulumi ESC
const instanceSize = config.require("files-instance-size");
const domain = config.require("domain");


const instance = new aws.ec2.Instance("files-instance", {
  tags: {
    Name: `files-instance-${filesSubdomain}`,
  },
  instanceType: instanceSize,
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  vpcSecurityGroupIds: [filesEc2SecurityGroup.id],
  ami: latestAmazonLinuxAmi.id,
  userDataReplaceOnChange: true,
  userData: pulumi.all([redisHost, redisPort]).apply(([host, port]) =>
    runDockerImageBashScript(
      filesECRName,
      dockerImageTag,
      filesPulumiEscEnvironmentName,
      {
        PUBSUB_HOST: host,
        PUBSUB_PORT: port.toString(),
        QUADRATIC_API_URI: quadraticApiUri,
      },
      true
    )
  ),
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

// Create a Route 53 record pointing to EC2 instance
const dnsRecord = new aws.route53.Record("files-r53-record", {
  zoneId: hostedZone.id,
  name: `${filesSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  ttl: 300,
  records: [instance.publicIp],
});

export const filesPublicDns = dnsRecord.fqdn;
