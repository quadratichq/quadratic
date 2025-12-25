#!/bin/sh
set -e

# Set timezone if TZ environment variable is provided
# This creates a symlink from /etc/localtime to the appropriate timezone file
# which is how Linux systems typically configure timezone
if [ -n "$TZ" ]; then
    echo "Setting timezone to: $TZ"

    # Explicitly export TZ to ensure child processes see it
    export TZ

    # Check if the timezone file exists
    if [ -f "/usr/share/zoneinfo/$TZ" ]; then
        # Remove existing /etc/localtime if it exists
        rm -f /etc/localtime

        # Create symlink to the specified timezone
        ln -s "/usr/share/zoneinfo/$TZ" /etc/localtime

        # Also update /etc/timezone for compatibility
        echo "$TZ" > /etc/timezone
    else
        echo "Warning: Timezone file /usr/share/zoneinfo/$TZ not found. Using default timezone."
    fi
else
    echo "No TZ environment variable set. Using default timezone (UTC)."
fi

# Execute the main application
exec ./quadratic-cloud-worker
