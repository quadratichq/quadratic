// Cloud Controller Network Configuration
//
// The cloud controller uses the SHARED VPC (same as multiplayer) to enable
// direct access to the shared Redis cluster. This is simpler than VPC peering
// and follows the same pattern as the multiplayer service.
//
// The VPC ID and subnet IDs are configured via Pulumi ESC.

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

// Configuration from Pulumi ESC - uses the shared VPC
const vpcId = config.require("vpc-id");
const subNet1 = config.require("subnet1");
const subNet2 = config.require("subnet2");

// Export subnet IDs for use in the main cloud controller module
export const cloudControllerSubnet1 = subNet1;
export const cloudControllerSubnet2 = subNet2;

// Create a Security Group for the Cloud Controller NLB
export const cloudControllerNlbSecurityGroup = new aws.ec2.SecurityGroup(
  "cloud-controller-nlb-security-group",
  {
    vpcId: vpcId,
    ingress: [
      {
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
    tags: { Name: "cloud-controller-nlb-sg" },
  },
);

// Create a Security Group for the Cloud Controller EC2 instance
export const cloudControllerEc2SecurityGroup = new aws.ec2.SecurityGroup(
  "cloud-controller-ec2-security-group",
  {
    vpcId: vpcId,
    ingress: [
      // Public server port (health checks, JWKS)
      {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        cidrBlocks: ["0.0.0.0/0"],
      },
      // Worker-only server port (internal communication from cloud workers)
      // Cloud workers are Docker containers on the same host, so they communicate
      // via the Docker bridge network. No external ingress needed for this port.
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
    tags: { Name: "cloud-controller-ec2-sg" },
  },
);
