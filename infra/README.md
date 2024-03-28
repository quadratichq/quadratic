There are two different AWS Accounts
- Production
- Development

There are some manually provisioned resources in both accounts.
- VPC (Default) is used for both environments
- IAM is managed manually for Pulumi stacks in Github Actions (see ima/github-actions.json)
- Route 53 Hosted Zones (quadratic-preview.com and quadratichq.com)
- Certificate ARN for both Domains

Those resources are shared between stacks.

All our application resources are created by the pulumi stack.