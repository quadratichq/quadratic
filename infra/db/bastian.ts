import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { apiPublicSubnet1, apiVPC } from "../api/api_network";
import {
  connectionEip1,
  connectionEip2,
} from "../connection/connection_network";
import { latestAmazonLinuxAmi } from "../helpers/latestAmazonAmi";

const config = new pulumi.Config();

// Bastion configuration
const instanceSize = config.require("db-bastion-instance-size");
const bastionPublicKeysRaw = config.get("db-bastion-public-keys") || "";

// Parse the SSH keys - handle both JSON array format and plain string
let bastionPublicKeys: string[] = [];
if (bastionPublicKeysRaw) {
  try {
    // Try to parse as JSON array first
    const parsedPublicKeys = JSON.parse(bastionPublicKeysRaw);
    if (Array.isArray(parsedPublicKeys)) {
      bastionPublicKeys = parsedPublicKeys;
    } else {
      bastionPublicKeys = parsedPublicKeys ? [parsedPublicKeys] : [];
    }
  } catch {
    // If parsing fails, treat as plain string
    bastionPublicKeys = bastionPublicKeysRaw ? [bastionPublicKeysRaw] : [];
  }
}
const primaryPublicKey = bastionPublicKeys[0];
const additionalPublicKeys = bastionPublicKeys.slice(1);
const additionalKeysString = additionalPublicKeys.join("\n");

// Create security group for bastion host
export const bastionSecurityGroup = new aws.ec2.SecurityGroup(
  "db-bastion-security-group",
  {
    vpcId: apiVPC.id,
    ingress: [
      {
        description: "SSH access from external service",
        protocol: "tcp",
        fromPort: 22,
        toPort: 22,
        cidrBlocks: pulumi
          .all([connectionEip1.publicIp, connectionEip2.publicIp])
          .apply(([eip1, eip2]) => {
            return [`${eip1}/32`, `${eip2}/32`]; // static connection elastic IPs
          }),
      },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
    tags: { Name: "db-bastion-security-group" },
  },
);

if (primaryPublicKey) {
  // Create key pair for SSH access
  const bastionKeyPair = new aws.ec2.KeyPair("db-bastion-key-pair", {
    keyName: "db-bastion-key",
    publicKey: primaryPublicKey,
  });

  // Create bastion host
  const bastionInstance = new aws.ec2.Instance(
    "db-bastion-instance",
    {
      tags: {
        Name: "db-bastion-host",
      },

      ami: latestAmazonLinuxAmi.id,
      instanceType: instanceSize,
      keyName: bastionKeyPair?.keyName,
      subnetId: apiPublicSubnet1.id,
      vpcSecurityGroupIds: [bastionSecurityGroup.id],

      userData: pulumi.interpolate`#!/bin/bash
# Enable debugging and logging
set -x
exec > >(tee /var/log/user-data.log) 2>&1

yum update -y
yum install -y postgresql17

# Configure SSH for database tunneling
echo "GatewayPorts yes" >> /etc/ssh/sshd_config
echo "AllowTcpForwarding yes" >> /etc/ssh/sshd_config
systemctl restart sshd

echo "Current authorized_keys content:"
cat /home/ec2-user/.ssh/authorized_keys || echo "authorized_keys file not found"

ADDITIONAL_KEYS_COUNT=${additionalPublicKeys.length}
echo "ADDITIONAL_KEYS_COUNT = $ADDITIONAL_KEYS_COUNT"

if [ $ADDITIONAL_KEYS_COUNT -gt 0 ]; then
  echo "Adding $ADDITIONAL_KEYS_COUNT additional SSH keys..."
  touch /home/ec2-user/.ssh/authorized_keys
  
  echo "${additionalKeysString}" >> /home/ec2-user/.ssh/authorized_keys
  
  chown ec2-user:ec2-user /home/ec2-user/.ssh/authorized_keys
  chmod 600 /home/ec2-user/.ssh/authorized_keys
  
  echo "Additional SSH keys added successfully"
else
  echo "No additional SSH keys to add"
fi
`,
    },
    { replaceOnChanges: ["*"] },
  );

  // Create Elastic IP
  const bastionEip = new aws.ec2.Eip("db-bastion-eip", {
    domain: "vpc",
    tags: {
      Name: "db-bastion-eip",
    },
  });

  // Associate the Elastic IP with the bastion instance
  const bastionEipAssociation = new aws.ec2.EipAssociation(
    "db-bastion-eip-association",
    {
      instanceId: bastionInstance.id,
      allocationId: bastionEip.id,
    },
  );
}
