import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import { apiEc2SecurityGroup } from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const apiSubdomain = config.require("api-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const apiECRName = config.require("api-ecr-repo-name");
const apiPulumiEscEnvironmentName = config.require(
  "api-pulumi-esc-environment-name"
);

// Configuration from Pulumi ESC
const instanceSize = config.require("api-instance-size");
const domain = config.require("domain");


const instance = new aws.ec2.Instance("api-instance", {
  tags: {
    Name: `api-instance-${apiSubdomain}`,
  },
  instanceType: instanceSize,
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  vpcSecurityGroupIds: [apiEc2SecurityGroup.id],
  ami: latestAmazonLinuxAmi.id,
  userDataReplaceOnChange: true,
  userData: pulumi.all([]).apply(([]) =>
    runDockerImageBashScript(
      apiECRName,
      dockerImageTag,
      apiPulumiEscEnvironmentName,
      {
        PORT: "80"
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
const dnsRecord = new aws.route53.Record("api-r53-record", {
  zoneId: hostedZone.id,
  name: `${apiSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  ttl: 300,
  records: [instance.publicIp],
});

export const apiPublicDns = dnsRecord.fqdn;
