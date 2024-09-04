#!/bin/bash

# Self-Hosting Initialization
# 
# Usage:
# 
#   ./init.sh 83f0ebdf-eafb-4c8d-bd7b-04ea07d61b7f localhost
# 
# 
# Flow:
# 
# First, check to see if there is a VERSION file, if so, use that version.
# If not, then check for the first command line argument, if so, use that version.
# Else, prompt the user.
# 
# First, check to see if there is a HOST file, if so, use that host.
# If not, then check for the first command line argument, if so, use that host.
# Else, prompt the user.

REPO="https://github.com/quadratichq/quadratic.git"
BRANCH="self-hosting-setup"
DIR="self-hosting"
SELF_HOSTING_URI="https://selfhost.quadratic-preview.com"
INVALID_LICENSE_KEY="Invalid license key."

get_license_key() {
    read -p "Enter your license key (Get one for free instantly at $SELF_HOSTING_URI): " user_input
    
    if [[ $user_input =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
      echo $user_input
    else
      echo $INVALID_LICENSE_KEY
      return 1
    fi
}

get_host() {
    read -p "What public host name or public IP address are you using for this setup (e.g. localhost, app.quadratic.com, or other): " user_input
    
    # TODO: validate host
    echo $user_input
}

checkout() {
  git clone -b $BRANCH --filter=blob:none --no-checkout --depth 1 --sparse $REPO
  cd quadratic
  git sparse-checkout set ${DIR}/
  git checkout

}

LICENSE_KEY=""
HOST=""

if [ -f "quadratic/LICENSE" ]; then
  LICENSE_KEY=$(<quadratic/LICENSE)
elif [ $1 ]; then
  LICENSE_KEY=$1
else
  LICENSE_KEY=$(get_license_key)
fi

if [ -f "quadratic/HOST" ]; then
  HOST=$(<quadratic/HOST)
elif [ $2 ]; then
  HOST=$2
else
  HOST=$(get_host)
fi

# retrieve the code from github
checkout

# write license key to LICENSE file
touch LICENSE
echo $LICENSE_KEY > LICENSE

# write host to HOST file
touch HOST
echo $HOST > HOST

cp -a self-hosting/. .
rm -rf self-hosting
rm ../init.sh
rm init.sh

# adding .bak for compatibility with both GNU (Linux) and BSD (MacOS) sed
sed -i.bak "s/#LICENSE_KEY#/$LICENSE_KEY/g" "docker-compose.yml"
sed -i.bak "s/#HOST#/$HOST/g" "docker-compose.yml"
sed -i.bak "s/#HOST#/$HOST/g" "docker/ory-auth/config/kratos.yml"

rm docker-compose.yml.bak
rm docker/ory-auth/config/kratos.yml.bak

sh start.sh
