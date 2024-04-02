import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import { clientEc2SecurityGroup } from "../shared/securityGroups";
import { multiplayerPublicDns } from "../multiplayer/multiplayer";
import { apiPublicDns } from "../api/api";
const config = new pulumi.Config();

// Configuration from command line
const clientSubdomain = config.require("client-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const clientECRName = config.require("client-ecr-repo-name");
const clientPulumiEscEnvironmentName = config.require(
  "client-pulumi-esc-environment-name"
);
const ecrRegistryUrl = config.require("ecr-registry-url");

// Configuration from Pulumi ESC
const instanceSize = config.require("client-instance-size");
const domain = config.require("domain");

// Confugration from other resources
const apiUri = apiPublicDns.apply((apiPublicDns) => `http://${apiPublicDns}`);
const multiplayerUri = multiplayerPublicDns.apply((multiplayerPublicDns) => `https://${multiplayerPublicDns}`);

const instance = new aws.ec2.Instance("client-instance", {
  tags: {
    Name: `client-instance-${clientSubdomain}`,
  },
  instanceType: instanceSize,
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  vpcSecurityGroupIds: [clientEc2SecurityGroup.id],
  ami: latestAmazonLinuxAmi.id,
  keyName: "dba-quadratic",
  userDataReplaceOnChange: true,

  userData: pulumi.all([]).apply(([]) =>
    runDockerImageBashScript(
      clientECRName,
      dockerImageTag,
      clientPulumiEscEnvironmentName,
      {
        PORT: "80",
        VITE_QUADRATIC_API_URL: apiUri,
        VITE_QUADRATIC_MULTIPLAYER_URL: multiplayerUri,
      },
      "",
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
const dnsRecord = new aws.route53.Record("client-r53-record", {
  zoneId: hostedZone.id,
  name: `${clientSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  ttl: 300,
  records: [instance.publicIp],
});

export const clientPublicDns = dnsRecord.fqdn;
