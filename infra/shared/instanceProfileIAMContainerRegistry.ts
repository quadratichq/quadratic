import * as aws from "@pulumi/aws";

// Create an IAM Role with access to AWS Container Registry (ECR)
// Create an instance profile to attach the IAM Role to any EC2 instance pulling docker images from ECR

const role = new aws.iam.Role("instance-profile-iam-container-registry-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "ec2.amazonaws.com",
        },
      },
    ],
  }),
});

// Attach the AmazonEC2ContainerRegistryReadOnly policy
const policyAttachment = new aws.iam.RolePolicyAttachment(
  "instance-profile-iam-container-registry-policy-attachment",
  {
    role: role,
    policyArn: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
  }
);

// Create and export the instance profile
export const instanceProfileIAMContainerRegistry = new aws.iam.InstanceProfile(
  "instance-profile-iam-container-registry",
  {
    role: role,
  }
);
