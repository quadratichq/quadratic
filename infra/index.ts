import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";

const size = "t2.micro";

const targetGroupArn =
  "arn:aws:elasticloadbalancing:us-west-2:896845383385:targetgroup/test-multiplayer-3/6f03de054c2c866f";

const ami = pulumi.output(
  aws.ec2.getAmi({
    owners: ["099720109477"], // Canonical ID
    mostRecent: true,
    filters: [
      {
        name: "name",
        values: ["ubuntu/images/hvm-ssd/ubuntu-*-amd64-server-*"],
      },
      { name: "architecture", values: ["x86_64"] },
      { name: "root-device-type", values: ["ebs"] },
    ],
  })
);

const group = new aws.ec2.SecurityGroup(
  "security-group-ec2-quadratic-multiplayer",
  {
    ingress: [
      { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
      { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
  }
);

// Read the content of the Bash script
const userData = fs.readFileSync(
  "scripts/setup-multiplayer-service.sh",
  "utf-8"
);
const instance = new aws.ec2.Instance("quadratic-multiplayer", {
  instanceType: size,
  securityGroups: [group.name],
  ami: ami.id,
  keyName: "test2",
  // other configuration
  userData: userData,
});

// Attach the instance to the target group
const targetGroupAttachment = new aws.lb.TargetGroupAttachment(
  "attachInstance",
  {
    targetId: instance.id,
    targetGroupArn: targetGroupArn,
  }
);

export const publicIp = instance.publicIp;
export const publicDns = instance.publicDns;
