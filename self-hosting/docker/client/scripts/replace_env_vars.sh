#!/bin/sh

escape_for_sed() {
  input="$1"
  printf '%s\n' "$input" | sed -e 's/[\/&]/\\&/g'
}

replace_env_vars() {
  vite_vars=""

  for env_var in $(env); do
    case "$env_var" in
      VITE_*)
        vite_vars="$vite_vars $env_var"
        ;;
    esac
  done

  find "/usr/share/nginx/html/assets" -type f -name "*.js" | xargs grep -l "VITE_" | while read file; do   
    
    for env_var in $vite_vars; do
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
