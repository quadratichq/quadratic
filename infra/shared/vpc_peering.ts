import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { apiVPC, publicRouteTable } from "../api/api_network";

const config = new pulumi.Config();

// Shared VPC ID from Pulumi ESC
const sharedVpcId = config.require("vpc-id");

// Known CIDR blocks (hardcoded to avoid Output type complications)
const API_VPC_CIDR = "10.0.0.0/16";

// Create VPC Peering Connection between api-vpc and shared VPC
export const vpcPeeringConnection = new aws.ec2.VpcPeeringConnection(
  "api-shared-vpc-peering",
  {
    vpcId: apiVPC.id, // Requester: api-vpc
    peerVpcId: sharedVpcId, // Accepter: shared VPC
    autoAccept: true, // Auto-accept since both VPCs are in the same account
    tags: { Name: "api-shared-vpc-peering" },
  },
);

// Get the shared VPC to find its CIDR block
const sharedVpcCidr = aws.ec2.getVpcOutput({ id: sharedVpcId }).cidrBlock;

// Add route from api-vpc public subnet (where files is) to shared VPC via peering
new aws.ec2.Route("api-to-shared-vpc-route", {
  routeTableId: publicRouteTable.id,
  destinationCidrBlock: sharedVpcCidr,
  vpcPeeringConnectionId: vpcPeeringConnection.id,
});

// Add route from shared VPC to api-vpc
// Get the main route table of shared VPC
const sharedVpcMainRouteTable = aws.ec2.getRouteTableOutput({
  vpcId: sharedVpcId,
  filters: [{ name: "association.main", values: ["true"] }],
});

new aws.ec2.Route("shared-to-api-vpc-route", {
  routeTableId: sharedVpcMainRouteTable.routeTableId,
  destinationCidrBlock: API_VPC_CIDR,
  vpcPeeringConnectionId: vpcPeeringConnection.id,
});

