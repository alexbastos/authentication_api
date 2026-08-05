#!/bin/bash
# ─── Generate RSA Key Pair for JWT RS256 ───────────────────────────────────
# Run this script to generate the private/public key pair used for signing JWTs.
# These keys should be stored securely and NEVER committed to version control.

set -e

KEYS_DIR="./keys"

echo "🔑 Generating RSA key pair for JWT RS256..."

# Create keys directory if it doesn't exist
mkdir -p "$KEYS_DIR"

# Generate 2048-bit RSA private key
openssl genrsa -out "$KEYS_DIR/private.pem" 2048

# Extract public key from private key
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

# Set permissions (read-only for the owner)
chmod 600 "$KEYS_DIR/private.pem"
chmod 644 "$KEYS_DIR/public.pem"

echo "✅ Keys generated successfully:"
echo "   Private key: $KEYS_DIR/private.pem"
echo "   Public key:  $KEYS_DIR/public.pem"
echo ""
echo "⚠️  IMPORTANT: Never commit these keys to version control!"
echo "   In production, use AWS Secrets Manager or similar."
