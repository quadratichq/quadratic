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
const bastionPublicKey = config.require("db-bastion-public-key");

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

// Create key pair for SSH access
const bastionKeyPair = new aws.ec2.KeyPair("db-bastion-key-pair", {
  keyName: "db-bastion-key",
  publicKey: bastionPublicKey,
});

// Create bastion host
const bastionInstance = new aws.ec2.Instance("db-bastion-instance", {
  tags: {
    Name: "db-bastion-host",
  },

  ami: latestAmazonLinuxAmi.id,
  instanceType: instanceSize,
  keyName: bastionKeyPair.keyName,
  subnetId: apiPublicSubnet1.id,
  vpcSecurityGroupIds: [bastionSecurityGroup.id],

  userData: `#!/bin/bash
    yum update -y
    yum install -y postgresql17

    # Configure SSH for database tunneling
    echo "GatewayPorts yes" >> /etc/ssh/sshd_config
    echo "AllowTcpForwarding yes" >> /etc/ssh/sshd_config
    systemctl restart sshd
  `,
});
