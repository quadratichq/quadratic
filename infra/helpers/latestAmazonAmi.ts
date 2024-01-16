import * as aws from "@pulumi/aws";

// Function to get the latest Amazon Linux 2 AMI
export const latestAmazonLinuxAmi = aws.ec2.getAmiOutput({
  filters: [
    {
      name: "name",
      values: ["amzn2-ami-hvm-*-x86_64-gp2"],
    },
  ],
  owners: ["amazon"], // This is the AWS account ID for Amazon
  mostRecent: true,
});
