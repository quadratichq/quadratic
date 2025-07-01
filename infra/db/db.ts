import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import {
  apiEc2SecurityGroup,
  apiPrivateSubnet1,
  apiPrivateSubnet2,
  apiVPC,
} from "../api/api_network";

const config = new pulumi.Config();

// Database configuration
const dbInstanceClass = config.get("db-instance-size") ?? "db.m5d.large";
const dbAllocatedStorage = config.getNumber("db-allocated-storage") ?? 100;
const dbMaxAllocatedStorage =
  config.getNumber("db-max-allocated-storage") ?? 2000;
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
    ],
    // No egress rules - database doesn't need to initiate outbound connections
    tags: { Name: "db-postgresql-security-group" },
  },
);

// Create DB Subnet Group using private subnets only
const dbSubnetGroup = new aws.rds.SubnetGroup("db-postgresql-subnet-group", {
  subnetIds: [apiPrivateSubnet1.id, apiPrivateSubnet2.id],
  tags: {
    Name: `db-postgresql-subnet-group`,
  },
});

// Create PostgreSQL RDS instance
const db = new aws.rds.Instance("db-postgresql", {
  identifier: "db-postgresql-quadratic",

  tags: {
    Name: `db-postgresql-quadratic`,
  },

  // Database configuration - Latest PostgreSQL version
  engine: "postgres",
  engineVersion: "17.5",
  instanceClass: dbInstanceClass,
  allocatedStorage: dbAllocatedStorage,
  maxAllocatedStorage: dbMaxAllocatedStorage,
  storageType: "gp3",
  storageEncrypted: true,

  // Database credentials
  dbName: dbName,
  username: dbUsername,
  password: dbPassword,

  // Network configuration - locked to API VPC private subnets only
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  dbSubnetGroupName: dbSubnetGroup.name,
  publiclyAccessible: false, // Ensure no public access
  multiAz: false,

  // Backup and maintenance
  backupRetentionPeriod: 7,
  backupWindow: "03:00-04:00",
  maintenanceWindow: "sun:04:00-sun:05:00",
  autoMinorVersionUpgrade: true, // Automatically get latest PostgreSQL 17.x minor versions

  // Performance and monitoring
  performanceInsightsEnabled: true,
  performanceInsightsRetentionPeriod: 7,
  monitoringInterval: 60,
  monitoringRoleArn: rdsMonitoringRole.arn,
  enabledCloudwatchLogsExports: ["postgresql", "upgrade"],

  // Delete protection
  deletionProtection: true,
  skipFinalSnapshot: false,
  finalSnapshotIdentifier: pulumi.interpolate`db-postgresql-quadratic-final-snapshot-${Date.now()}`,

  // Apply changes immediately (be careful with this in production)
  applyImmediately: false,
});

// Create database URL for connection string with password
export const databaseUrl = pulumi
  .all([db.username, db.password, db.endpoint, db.dbName])
  .apply(
    ([username, password, endpoint, dbName]) =>
      `postgresql://${username}:${password}@${endpoint}/${dbName}`,
  );
