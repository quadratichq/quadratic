import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import {
    apiEc2SecurityGroup,
    apiPrivateSubnet1,
    apiPrivateSubnet2,
    apiPrivateSubnet3,
    apiVPC,
} from "../api/api_network";
import { bastionSecurityGroup } from "./bastian";

const config = new pulumi.Config();

// Database configuration
const dbInstanceClass = config.get("db-instance-size") ?? "db.r8g.large";
const dbInstanceCount = config.getNumber("db-instance-count") ?? 1;
const dbName = config.get("db-name") ?? "quadratic";
const dbUsername = config.get("db-username") ?? "postgres";
const dbPassword = config.get("db-password") ?? "postgres";

// Create IAM role for RDS enhanced monitoring
const rdsMonitoringRole = new aws.iam.Role(
  "db-postgresql-rds-monitoring-role",
  {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "",
          Effect: "Allow",
          Principal: {
            Service: "monitoring.rds.amazonaws.com",
          },
          Action: "sts:AssumeRole",
        },
      ],
    }),
    tags: {
      Name: "rds-enhanced-monitoring-role",
    },
  },
);

// Attach the AWS managed policy for RDS enhanced monitoring
const rdsMonitoringPolicyAttachment = new aws.iam.RolePolicyAttachment(
  "db-postgresql-rds-monitoring-policy-attachment",
  {
    role: rdsMonitoringRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole",
  },
);

// Create a Security Group for the PostgreSQL database
const dbSecurityGroup = new aws.ec2.SecurityGroup(
  "db-postgresql-security-group",
  {
    vpcId: apiVPC.id,
    ingress: [
      {
        description: "Allow API instances to connect to the database",
        protocol: "tcp",
        fromPort: 5432,
        toPort: 5432,
        securityGroups: [apiEc2SecurityGroup.id],
      },
      {
        description: "Allow bastion host to connect to the database",
        protocol: "tcp",
        fromPort: 5432,
        toPort: 5432,
        securityGroups: [bastionSecurityGroup.id],
      },
    ],
    tags: { Name: "db-postgresql-security-group" },
  },
);

// Create DB Subnet Group using private api subnets only
const dbSubnetGroup = new aws.rds.SubnetGroup("db-postgresql-subnet-group", {
  subnetIds: [apiPrivateSubnet1.id, apiPrivateSubnet2.id, apiPrivateSubnet3.id],
  tags: {
    Name: `db-postgresql-limitless-subnet-group`,
  },
});

// Create Aurora PostgreSQL cluster
const dbCluster = new aws.rds.Cluster(
  "db-postgresql-cluster",
  {
    clusterIdentifier: "db-postgresql-quadratic-cluster",

    tags: {
      Name: `db-postgresql-quadratic-cluster`,
    },

    // Database configuration - Aurora PostgreSQL
    engine: "aurora-postgresql",
    engineVersion: "17.4",

    // Version upgrade settings
    allowMajorVersionUpgrade: true,

    // Aurora I/O-Optimized storage
    storageType: "aurora-iopt1",
    storageEncrypted: true,

    // Database credentials
    databaseName: dbName,
    masterUsername: dbUsername,
    masterPassword: dbPassword,

    // Network configuration
    vpcSecurityGroupIds: [dbSecurityGroup.id],
    dbSubnetGroupName: dbSubnetGroup.name,

    // High Availability - Aurora automatically distributes instances across
    // the AZs in the subnet group for fault tolerance and automatic failover
    availabilityZones: ["us-west-2a", "us-west-2b", "us-west-2c"],

    // Backup and maintenance
    backupRetentionPeriod: 30,
    preferredBackupWindow: "03:00-04:00",
    preferredMaintenanceWindow: "sun:04:00-sun:05:00",

    // Performance Insights
    performanceInsightsEnabled: true,
    performanceInsightsRetentionPeriod: 7,

    // CloudWatch logs exports
    enabledCloudwatchLogsExports: ["postgresql"],

    // Delete protection
    deletionProtection: true,
    skipFinalSnapshot: false,
    finalSnapshotIdentifier: `db-postgresql-cluster-final-snapshot-${pulumi.getStack()}`,

    applyImmediately: false,
  },
  {
    dependsOn: [rdsMonitoringPolicyAttachment],
  },
);

// Create Aurora PostgreSQL cluster instances
const dbClusterInstances: aws.rds.ClusterInstance[] = [];
for (let i = 0; i < dbInstanceCount; i++) {
  const dbClusterInstance = new aws.rds.ClusterInstance(
    `db-postgresql-instance-${i + 1}`,
    {
      identifier: `db-postgresql-instance-${i + 1}`,
      tags: {
        Name: `db-postgresql-instance-${i + 1}`,
      },

      clusterIdentifier: dbCluster.clusterIdentifier,
      instanceClass: dbInstanceClass,
      engine: "aurora-postgresql",
      engineVersion: dbCluster.engineVersion,

      // Performance insights
      performanceInsightsEnabled: true,
      performanceInsightsRetentionPeriod: 7,

      // Monitoring
      monitoringInterval: 60,
      monitoringRoleArn: rdsMonitoringRole.arn,
    },
  );
  dbClusterInstances.push(dbClusterInstance);
}

// Cluster endpoints
const clusterEndpoint = dbCluster.endpoint;
const clusterReaderEndpoint = dbCluster.readerEndpoint;

// Export database URL (read/write)
export const databaseUrl = pulumi
  .all([
    dbCluster.masterUsername,
    dbCluster.masterPassword,
    clusterEndpoint,
    dbCluster.databaseName,
  ])
  .apply(
    ([username, password, endpoint, dbName]) =>
      `postgresql://${username}:${password}@${endpoint}/${dbName}`,
  );

// Export database URL (read only)
export const databaseReaderUrl = pulumi
  .all([
    dbCluster.masterUsername,
    dbCluster.masterPassword,
    clusterReaderEndpoint,
    dbCluster.databaseName,
  ])
  .apply(
    ([username, password, endpoint, dbName]) =>
      `postgresql://${username}:${password}@${endpoint}/${dbName}`,
  );
