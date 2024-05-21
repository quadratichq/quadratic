import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// Define a function to create a common ingress rule for a security group
export const addOpenSSHRule = (securityGroupId: pulumi.Input<string>) => {
  return new aws.ec2.SecurityGroupRule(
    `common-ingress-rule-${securityGroupId}`,
    {
      type: "ingress",
      fromPort: 80,
      toPort: 80,
      protocol: "tcp",
      cidrBlocks: ["0.0.0.0/0"],
      securityGroupId: securityGroupId,
    }
  );
};
