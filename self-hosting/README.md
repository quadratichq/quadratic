# Quadratic Self-Hosting

Implement the entire Quadratic stack outside of Quadratic.  The use cases we currently support: 

- [x] Localhost
- [x] EC2 (using your own load balancer)
- [ ] EC2 (using [Caddy's load balancer](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy))
- [ ] Multiple Docker instance setup (for any cloud provider)
- [ ] Kubernetes

## Dependencies

* [Git](https://github.com/git-guides/install-git)
* [Docker](https://docs.docker.com/engine/install/)

## Requirements

* MacOS or Linux (not tested on Windows)
* License Key (available at https://selfhost.quadratic-preview.com)
* The following open ports: 80, 3000, 3001, 3002, 8000

## Installation

> **NOTE:** _Before  installing, please create a license and copy the key at https://selfhost.quadratic-preview.com._ 

Quadratic can be installed via a single command: 

```shell
curl -sSf https://raw.githubusercontent.com/quadratichq/quadratic/2b9f2eaecac7eb7e990c3de5f364fa20fe907a3a/self-hosting/init.sh -o init.sh && bash -i init.sh
```

This will download the initialization script, which will prompt for a license key in order to register Quadratic.  

Additionally, the docker compose network will start (see [Starting](#Starting)).  Please allow several minutes for the docker images to downloaded.

Refer to the [Stopping](#Stopping) section.

## Starting

Once the Quadratic is initialized, a single command is needed to start all of the images:

```shell
./quadratic/self-hosting/start.sh
```

## Stopping

To stop running docker images, simply press `ctrl + c` if running in the foreground.

If running in the background, run the `stop.sh` script:

```shell
./quadratic/self-hosting/stop.sh
```

## Installing on Ubuntu

```shell
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get -y install docker-ce docker-ce-cli containerd.io
sudo docker --version
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo chown $USER /var/run/docker.sock
sudo systemctl enable docker
sudo systemctl start docker
curl -sSf https://raw.githubusercontent.com/quadratichq/quadratic/2b9f2eaecac7eb7e990c3de5f364fa20fe907a3a/self-hosting/init.sh -o init.sh && bash -i init.sh
```
