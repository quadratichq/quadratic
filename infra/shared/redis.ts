import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { redisSecurityGroup } from "./securityGroups";
const config = new pulumi.Config();

const redisClusterSize = config.require("redis-cluster-size");

// Create a Redis ElastiCache cluster
const cluster = new aws.elasticache.Cluster("multiplayer-redis-cluster", {
  engine: "redis",
  engineVersion: "7.1",
  nodeType: redisClusterSize,
  numCacheNodes: 1,
  securityGroupIds: [redisSecurityGroup.id],
});

export const redisHost = cluster.cacheNodes.apply((nodes) => nodes[0].address);
export const redisPort = cluster.port;
