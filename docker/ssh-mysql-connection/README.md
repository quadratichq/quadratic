# MySql Connection via a SSH Tunnel

## Build the Docker Image

```bash
docker build -t ssh-mysql-connection -f docker/ssh-mysql-connection/Dockerfile .
```

## Run the Docker Container

```bash
docker run -d -p 2223:22 --name ssh-mysql-connection ssh-mysql-connection
```

## Connect to the SSH Tunnel

```bash
ssh -p 2223 dbuser@localhost
```

Use `password` for the SSH password when prompted.

## Connect to the mysql Database

```bash
mysql -h localhost -p 3306 -u dbuser -p mydb
```

Use `dbpassword` for the mysql password when prompted.


