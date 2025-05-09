# Postgres Connection via a SSH Tunnel

## Build the Docker Image

```bash
docker build -t ssh-postgres-connection .
```

## Run the Docker Container

```bash
docker run -d -p 2222:22 --name ssh-postgres-connection ssh-postgres-connection
```

## Connect to the Postgres Database

```bash
ssh -p 2222 dbuser@localhost
ssh -L 5432:localhost:5432 dbuser@localhost -p 2222
```



