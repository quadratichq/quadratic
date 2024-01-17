import * as aws from "@pulumi/aws";
import { filesEc2SecurityGroup } from "../files/files";

// Redis Security Group
const redisSecurityGroup = new aws.ec2.SecurityGroup("redis-sg", {
  ingress: [
    {
      protocol: "tcp",
      fromPort: 6379,
      toPort: 6379,
      securityGroups: [filesEc2SecurityGroup.id],
    },
  ],
});

// Create a Redis ElastiCache cluster
const redisCluster = new aws.elasticache.Cluster("multiplayer-redis-cluster", {
  engine: "redis",
  engineVersion: "7.1",
  nodeType: "cache.t4g.micro",
  numCacheNodes: 1,
  securityGroupIds: [redisSecurityGroup.id],
});

export const redisHost = redisCluster.cacheNodes.apply(
  (nodes) => nodes[0].address
);
export const redisPort = redisCluster.port;
