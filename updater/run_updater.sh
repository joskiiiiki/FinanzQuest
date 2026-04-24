#!/bin/sh
updater \
  --db-url "$DB_URL" \
  --alpaca-secret-key "$ALPACA_SECRET_KEY" \
  --alpaca-key-id "$ALPACA_KEY_ID" \
  --yf-timeout "$YF_TIMEOUT" \
  --alpaca-timeout "$ALPACA_TIMEOUT" \
  --batch-size "$BATCH_SIZE" \
  --fetch-chunk-size "$FETCH_CHUNK_SIZE"
