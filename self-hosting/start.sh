#!/bin/sh

escape_for_sed() {
  local input="$1"
  printf '%s\n' "$input" | sed -e 's/[\/&]/\\&/g'
}

replace_env_vars() {
  TEMP=$'\r\n' GLOBIGNORE='*' command eval  'ENV_VARS=($(cat .env))'

  find "/usr/share/nginx/html" -type f -name "*.js" | while read file; do
    echo "Replacing values in $file"
    
    for env_var in "${ENV_VARS[@]}"; do
      var=${env_var%=*}
      val=${env_var#*=}
      escaped_val=$(escape_for_sed "$val")

      # echo "Replacing $var with ${val} in $file"
      
      sed -i '' "s/\($var:\"\)[^\"]*\"/\1$(echo "$escaped_val")\"/g" $file
    done
  done
}

# cd ..
# rm -rf self-hosting/docker/caddy/quadratic-client/*
# npm run build --workspace=quadratic-client
# cp -r quadratic-client/build self-hosting/docker/caddy/quadratic-client

# cd self-hosting
replace_env_vars