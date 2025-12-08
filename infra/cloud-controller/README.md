# Cloud Controller

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