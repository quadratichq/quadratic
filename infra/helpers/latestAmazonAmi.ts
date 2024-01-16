import * as aws from "@pulumi/aws";

// Function to get the latest Amazon Linux 2 AMI
export const latestAmazonLinuxAmi = aws.ec2.getAmiOutput({
  filters: [
    {
      name: "name",
      values: ["al2023-ami-2023*-*-x86_64"],
    },
  ],
  owners: ["amazon"], // This is the AWS account ID for Amazon
  mostRecent: true,
});
