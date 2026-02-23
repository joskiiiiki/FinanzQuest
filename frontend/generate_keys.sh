#!/bin/sh
set -e

URL_SERVER=$1
URL_CLIENT=$2
SECRET=$3

if [ -z "$URL_SERVER" ] || [ -z "$URL_CLIENT" ] || [ -z "$SECRET" ]; then
    echo "Usage: $0 <supabase_server_url> <supabase_client_url> <jwt_secret>" >&2
    exit 1
fi

# Current timestamp
IAT=$(date +%s)
# 5 years expiration
EXP=$((IAT + 157680000))

# Generate anon key
ANON_HEADER='{"alg":"HS256","typ":"JWT"}'
ANON_PAYLOAD=$(cat <<EOF
{"role":"anon","iss":"supabase","iat":${IAT},"exp":${EXP}}
EOF
)

ANON_HEADER_B64=$(echo -n "$ANON_HEADER" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
ANON_PAYLOAD_B64=$(echo -n "$ANON_PAYLOAD" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
ANON_SIGNATURE=$(echo -n "${ANON_HEADER_B64}.${ANON_PAYLOAD_B64}" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
ANON_KEY="${ANON_HEADER_B64}.${ANON_PAYLOAD_B64}.${ANON_SIGNATURE}"

# Generate service_role key
SERVICE_HEADER='{"alg":"HS256","typ":"JWT"}'
SERVICE_PAYLOAD=$(cat <<EOF
{"role":"service_role","iss":"supabase","iat":${IAT},"exp":${EXP}}
EOF
)

SERVICE_HEADER_B64=$(echo -n "$SERVICE_HEADER" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
SERVICE_PAYLOAD_B64=$(echo -n "$SERVICE_PAYLOAD" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
SERVICE_SIGNATURE=$(echo -n "${SERVICE_HEADER_B64}.${SERVICE_PAYLOAD_B64}" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
SERVICE_KEY="${SERVICE_HEADER_B64}.${SERVICE_PAYLOAD_B64}.${SERVICE_SIGNATURE}"

cat <<EOF

NEXT_PUBLIC_SUPABASE_SERVER_URL=${URL_SERVER}
NEXT_PUBLIC_SUPABASE_CLIENT_URL=${URL_CLIENT}

NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}
EOF
