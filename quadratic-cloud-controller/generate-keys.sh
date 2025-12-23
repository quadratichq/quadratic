#!/bin/bash

# Generate RSA key pair for JWT signing/verification in cloud-controller
# This creates a private key and outputs the corresponding JWKS for all services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRIVATE_KEY_FILE="${SCRIPT_DIR}/controller_private.pem"

echo "=== Generating RSA Private Key ==="
openssl genpkey -algorithm RSA -out "$PRIVATE_KEY_FILE" -pkeyopt rsa_keygen_bits:2048

echo ""
echo "=== Private key saved to: $PRIVATE_KEY_FILE ==="
echo ""

# Extract modulus as base64url
N=$(openssl rsa -in "$PRIVATE_KEY_FILE" -pubout 2>/dev/null | \
    openssl rsa -pubin -modulus -noout 2>/dev/null | \
    cut -d= -f2 | \
    xxd -r -p | \
    base64 | \
    tr '+/' '-_' | \
    tr -d '=\n')

# e is always AQAB for exponent 65537
E="AQAB"

# Generate a unique kid with timestamp
KID="quadratic_controller_$(date +%s)"

# Build the JWKS JSON
JWKS="{\"keys\":[{\"alg\":\"RS256\",\"kty\":\"RSA\",\"use\":\"sig\",\"n\":\"${N}\",\"e\":\"${E}\",\"kid\":\"${KID}\"}]}"

# Escape the private key for env var
ESCAPED_KEY=$(cat "$PRIVATE_KEY_FILE" | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')

echo "=============================================="
echo "=== CLOUD-CONTROLLER .env ==="
echo "=============================================="
echo ""
echo "# Private key for signing worker JWTs"
echo "QUADRATIC_JWT_ENCODING_KEY=\"${ESCAPED_KEY}\""
echo ""
echo "# Public JWKS for validating worker JWTs"
echo "QUADRATIC_JWKS='${JWKS}'"
echo ""

echo "=============================================="
echo "=== MULTIPLAYER .env (add to existing) ==="
echo "=============================================="
echo ""
echo "# Cloud-controller JWKS for validating worker JWTs"
echo "QUADRATIC_JWKS='${JWKS}'"
echo ""

echo "=============================================="
echo "=== CONNECTION .env (add to existing) ==="
echo "=============================================="
echo ""
echo "# Cloud-controller JWKS for validating worker JWTs"
echo "QUADRATIC_JWKS='${JWKS}'"
echo ""

echo "=== Done ==="
echo ""
echo "Note: multiplayer and connection will merge this JWKS with"
echo "      their existing JWKS_URI keys (e.g., WorkOS) at startup."
