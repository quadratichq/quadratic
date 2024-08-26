#!/bin/sh

REPO="https://github.com/quadratichq/quadratic.git"
BRANCH="self-hosting-setup"
DIR="self-hosting"
INVALID_LICENSE_KEY="Invalid license key."

get_license_key() {
    read -p "Please enter your license key: " user_input
    
    if [[ $user_input =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
      echo $user_input
    else
      echo $INVALID_LICENSE_KEY
      return 1
    fi
}

checkout() {
  git clone -b $BRANCH --filter=blob:none --no-checkout --depth 1 --sparse $REPO
  cd quadratic
  git sparse-checkout set ${DIR}/
  git checkout
  cd $DIR

}

LICENSE_KEY=$(get_license_key)

if [ "$LICENSE_KEY" = "$INVALID_LICENSE_KEY" ]; then
  echo $INVALID_LICENSE_KEY
else
  checkout

  sed -i '' "s/\"LICENSE_KEY\"/\"$LICENSE_KEY\"/g" "docker-compose.yml"
  
  sh start.sh
fi
