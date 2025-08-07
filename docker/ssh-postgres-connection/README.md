# Postgres Connection via a SSH Tunnel

## Build the Docker Image

```bash
docker build -t ssh-postgres-connection -f docker/ssh-postgres-connection/Dockerfile .
```

## Run the Docker Container

```bash
docker run -d -p 2222:22 --name ssh-postgres-connection ssh-postgres-connection
```

## Connect to the SSH Tunnel

```bash
ssh -p 2222 dbuser@localhost
```

Use `password` for the SSH password when prompted.

## Connect to the Postgres Database

```bash
psql -h localhost -p 5432 -U dbuser -d mydb
```

Use `dbpassword` for the Postgres password when prompted.


