# Cloud Controller

Infra for quadratic-cloud-controller.

## Configuration Keys

| Config Key | Example Value | Source |
|------------|---------------|--------|
| `cloud-controller-subdomain` | `"cloud-controller"` | Command line |
| `cloud-controller-ecr-repo-name` | `"quadratic-cloud-controller"` | Command line |
| `cloud-worker-ecr-repo-name` | `"quadratic-cloud-worker"` | Command line |
| `cloud-controller-pulumi-esc-environment-name` | `"cloud-controller-prod"` | Command line |
| `cloud-controller-instance-size` | `"m5.2xlarge"` | ESC (has default) |
| `cloud-controller-root-volume-size` | `100` | ESC (has default) |


## Network Diagram

```draw
                                    ┌─────────────────────────────────────────┐
                                    │         EC2 Instance (m5.2xlarge)       │
Internet ──► Global Accelerator     │  ┌─────────────────────────────────┐    │
         ──► NLB (443)              │  │   Cloud Controller Container    │    │
         ──► EC2:80 ────────────────┼──►  - Port 80 (public/health)      │    │
                                    │  │  - Port 8080 (worker-only)      │    │
                                    │  │  - Docker socket mounted        │    │
                                    │  └─────────────┬───────────────────┘    │
                                    │                │ spawns                 │
                                    │                ▼                        │
                                    │  ┌─────────────────────────────────┐    │
                                    │  │  Cloud Worker Containers (x20)  │    │
                                    │  │  - Connect via host.docker.internal  │
                                    │  └─────────────────────────────────┘    │
                                    └─────────────────────────────────────────┘
                                                     │
                                                     ▼
                                              Redis (shared VPC)
```