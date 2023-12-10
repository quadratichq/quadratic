import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// This is currently not used. We build the client in Amplify.

// Assume you have a domain name, e.g., "example.com"
const domainName = "quadratic-preview.com";
const subdomainName = "app-preview-1";
const cdnPriceClass = "PriceClass_100";

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("client-bucket", {
  website: {
    indexDocument: "index.html",
  },
});

// Create an Origin Access Identity for the CloudFront distribution
const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
  "client-oai"
);

const bucketPolicy = new aws.s3.BucketPolicy("client-bucket-policy", {
  bucket: bucket.id,
  policy: pulumi
    .all([bucket.id, originAccessIdentity.iamArn])
    .apply(([bucketName, oaiArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: oaiArn },
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${bucketName}/*`,
          },
        ],
      })
    ),
});

// Create a CloudFront distribution for the S3 bucket
const cdn = new aws.cloudfront.Distribution("client-cdn", {
  origins: [
    {
      domainName: bucket.bucketDomainName,
      originId: originAccessIdentity.id,
      s3OriginConfig: {
        originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
      },
    },
  ],
  enabled: true,
  defaultCacheBehavior: {
    targetOriginId: originAccessIdentity.id,
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD"],
    cachedMethods: ["GET", "HEAD"],
    forwardedValues: {
      queryString: false,
      cookies: {
        forward: "none",
      },
    },
    minTtl: 0,
    defaultTtl: 3600,
    maxTtl: 86400,
  },
  priceClass: cdnPriceClass,
  defaultRootObject: "index.html",
  customErrorResponses: [
    {
      errorCode: 404,
      responseCode: 404,
      responsePagePath: "/404.html",
    },
  ],
  restrictions: {
    geoRestriction: {
      restrictionType: "none",
    },
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
});

// Create or use an existing hosted zone (uncomment the appropriate line)
// const hostedZone = new aws.route53.Zone("my-zone", { name: domainName });
const hostedZone = aws.route53.getZone({ name: domainName });

// Create a DNS record for the CloudFront distribution
const dnsRecord = new aws.route53.Record("client-cdn-record", {
  zoneId: hostedZone.then((hz) => hz.zoneId),
  name: `${subdomainName}.${domainName}`,
  type: "A",
  aliases: [
    {
      name: cdn.domainName,
      zoneId: cdn.hostedZoneId,
      evaluateTargetHealth: true,
    },
  ],
});

// Export the domain name of the CloudFront distribution
export const clientPublicDns = dnsRecord.name;
