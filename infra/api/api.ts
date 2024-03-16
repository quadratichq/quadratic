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

// postgres setup
const postgresPassword = "password";
const postgresUser = "quadratic_api";
const postgresDB = "quardratic_api";

// Set up any dependencies
const dependencySetupBashCommand = `
mkdir -p /var/lib/postgresql/data
docker run -d \
	--name ${apiECRName}-postgres \
	-e POSTGRES_PASSWORD=${postgresPassword} \
	-e PGDATA=/var/lib/postgresql/data/pgdata \
  -e POSTGRES_DB=${postgresDB} \
  -e POSTGRES_USER=${postgresUser} \
	-v /var/lib/postgresql/data:/var/lib/postgresql/data \
  -p 5432:5432 \
	postgres:15

# wait til postgres is up
sleep 5

# Run prisma migrate
sudo docker run \
            --name ${imageRepositoryName}-migrate \
            --env-file .env \
            ${ecrRegistryUrl}/${imageRepositoryName}:${imageTag} \
            npm run prisma:migrate --workspace=quadratic-api
`;

const instance = new aws.ec2.Instance("api-instance", {
  tags: {
    Name: `api-instance-${apiSubdomain}`,
  },
  instanceType: instanceSize,
  iamInstanceProfile: instanceProfileIAMContainerRegistry,
  vpcSecurityGroupIds: [apiEc2SecurityGroup.id],
  ami: latestAmazonLinuxAmi.id,
  keyName: "dba-quadratic",
  userDataReplaceOnChange: true,
  userData: pulumi.all([]).apply(([]) =>
    runDockerImageBashScript(
      apiECRName,
      dockerImageTag,
      apiPulumiEscEnvironmentName,
      {
        PORT: "80",
        DATABASE_URL: `postgres://${postgresUser}:${postgresPassword}@host.docker.internal:5432/${postgresDB}`,
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
const dnsRecord = new aws.route53.Record("api-r53-record", {
  zoneId: hostedZone.id,
  name: `${apiSubdomain}.${domain}`, // subdomain you want to use
  type: "A",
  ttl: 300,
  records: [instance.publicIp],
});

export const apiPublicDns = dnsRecord.fqdn;
