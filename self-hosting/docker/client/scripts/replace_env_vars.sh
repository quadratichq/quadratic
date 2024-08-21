#!/bin/sh

ENV_PATH="/client/config/.env"

escape_for_sed() {
  input="$1"
  printf '%s\n' "$input" | sed -e 's/[\/&]/\\&/g'
}

replace_env_vars() {
  ENV_VARS=$(cat $ENV_PATH)

  find "/usr/share/nginx/html/assets" -type f -name "*.js" | xargs grep -l "VITE_" | while read file; do   
    
    echo "$ENV_VARS" | while read env_var; do
      echo "env_var: $env_var"
      var="$(echo "$env_var" | cut -d'=' -f1)"
      val="$(echo "$env_var" | cut -d'=' -f2-)"
      appended_var="${var}_VAL"
      escaped_val=$(escape_for_sed "$val")

      echo "Replacing $appended_var with $escaped_val in $file"
      sed -i "s/${appended_var}/${escaped_val}/g" "$file"
    done
  done
}

echo "Replacing .env values in $ENV_PATH"
replace_env_vars
