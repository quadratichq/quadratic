import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";
import { runDockerImageBashScript } from "../helpers/runDockerImageBashScript";
import { instanceProfileIAMContainerRegistry } from "../shared/instanceProfileIAMContainerRegistry";
import { clientEc2SecurityGroup } from "../shared/securityGroups";
const config = new pulumi.Config();

// Configuration from command line
const clientSubdomain = config.require("client-subdomain");
const apiSubdomain = config.require("api-subdomain");
const multiplayerSubdomain = config.require("multiplayer-subdomain");
const dockerImageTag = config.require("docker-image-tag");
const clientECRName = config.require("client-ecr-repo-name");
const clientPulumiEscEnvironmentName = config.require(
  "client-pulumi-esc-environment-name"
);

// Configuration from Pulumi ESC
const instanceSize = config.require("client-instance-size");
const domain = config.require("domain");
const dependencySetupBashCommand = "";
const ecrRegistryUrl = config.require("ecr-registry-url");

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
      {
        name: clientECRName,
        image: `${ecrRegistryUrl}/${clientECRName}:${dockerImageTag}`,
        command: "npm start --workspace=quadratic-client -- --host",
        addHostDns: true,
        envFile: ".env",
        portMappings: [{ hostPort: 80, containerPort: 3000 }]
      },
      clientPulumiEscEnvironmentName,
      {
        VITE_QUADRATIC_API_URL: `http://${apiSubdomain}.${domain}`,
        VITE_QUADRATIC_MULTIPLAYER_URL: `https://${multiplayerSubdomain}.${domain}`,
      },
      dependencySetupBashCommand,
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
