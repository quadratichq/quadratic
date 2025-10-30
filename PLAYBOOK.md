<!-- omit in toc -->
# DevOps Playbook

- [Deploying QA](#deploying-qa)
- [Reverting a Deployment](#reverting-a-deployment)
- [Adding/Modifying Environment Variables](#addingmodifying-environment-variables)
- [SSH into a Preview Branch](#ssh-into-a-preview-branch)
  - [Recording a session for future network debugging (HAR)](#recording-a-session-for-future-network-debugging-har)


## Deploying QA
1. Run the bump script (`./bump.sh patch`) and create a PR
1. Merge the bump PR
1. Manually validate functionality
1. Verify CI has passed, including e2e tests
1. Have at least 2 people involved: Ops and QA
1. Merge `qa` into `main`, which will trigger the infrastructure deployment
1. Monitor the deployment within the Github Actions
1. Manually validate the basic features are working: dashboard, grid, connections, multiplayer, files
1. Merge `main` back into `qa`

## Reverting a Deployment
1. git checkout qa
1. git checkout -b "revert-to-v0.20.5"
1. git revert --no-commit v0.20.5..HEAD
1. git commit -m "Revert deployment to v0.20.5"
1. git push --set-upstream origin revert-to-v0.20.5

## Adding/Modifying Environment Variables

1. Modify environment variables
1. Modify the relevant variables in .env.example and .env.test as well
1. Modify the environment variables in the [self hosting repo](https://github.com/quadratichq/quadratic-selfhost).
   1. Create a PR, modify the environment variables in .env.aws, .env.aws-preview, .env.local
   1. Modify the variables in docker-compose.yml
   1. Merge PR into `main` as preview branches always pull from the main branch
1. If this is an existing PR, close and open the PR to trigger a new infrastructure deployment
1. Add a message to Slack in the `#engineering` channel about the changes
1. For `preview`:
   1. Log into the `Quadratic Development` AWS account (`us-west-2`)
   1. Navigate to the `Paramater Store` service
   1. Create or locate the environment variable (e.g. `/quadratic-development/ANTHROPIC_API_KEY`)
   1. Set the value and save
1. For `qa` and `prod`:
   1. Log into Pulumi (likely through the Github SSO) (https://app.pulumi.com/quadratic)
   3. Click on the `Environments` link in the left-hand sidebar
   4. Click the appropriate environment (`*-development` for `qa`, `*-production` for `prod`)
   5. Edit the values in the `environmentVariables:` section on the `Environment definition` text area
   6. Click on the `Save` button

## SSH into a Preview Branch
1. Locate the PR number in Github
1. Log into the `Quadratic Development` AWS account (`us-west-2`)
1. Navigate to the `EC2` service
1. Click on the `Instances` link in the left-hand sidebar or in the middle `Resources` section
1. Type in the PR number in the search interface
1. Click on the `Instance ID` link for the matching instance
1. Click on the `Connect` button in the upper right corner
1. Make sure the `Connect using a Public IP` option is selected and hit the orange `Connect` button
1. Wait a few momemnts for the SSH UI to load
1. Enter `docker ps` to see the running docker containers
1. There will be a container for every service, note the `CONTAINER ID` for each
1. Commands:
   1. View all logs: docker logs `CONTAINER ID`
   1. View live logs: docker logs -f `CONTAINER ID`
   1. View live tail logs: docker logs -f --tail 100 `CONTAINER ID`
   1. Enter into the container: docker exec -it `CONTAINER ID` bash

### Recording a session for future network debugging (HAR)
This should be used where production failed to deploy but you want to record the network activities before reverting.

See: https://support.zendesk.com/hc/en-us/articles/4408828867098-Generating-a-HAR-file-for-troubleshooting#h_01HRFHNXRB4YH4BMMGN6VEAYWB