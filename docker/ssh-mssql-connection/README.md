# MSSQL Connection via a SSH Tunnel

## Build the Docker Image

```bash
docker build -t ssh-mssql-connection -f docker/ssh-mssql-connection/Dockerfile .
```

## Run the Docker Container

```bash
docker run -d -p 2224:22 --name ssh-mssql-connection ssh-mssql-connection
```

## Connect to the SSH Tunnel

```bash
ssh -p 2224 dbuser@localhost
```

Use `password` for the SSH password when prompted.

## Connect to the mssql Database

```bash
mssql -h localhost -p 3306 -u dbuser -p mydb
```

Use `dbpassword` for the mssql password when prompted.


