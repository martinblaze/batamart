#!/bin/bash
# Copy the Let's Encrypt cert that Caddy obtained for mail.batamart.com into the relay, then reload Postfix.
set -e
SRC=/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/mail.batamart.com
DST=/opt/batamart-mail/certs
[ -f $SRC/mail.batamart.com.crt ] || { echo "no cert yet in $SRC"; exit 1; }
install -d -m 755 $DST
install -m 644 $SRC/mail.batamart.com.crt $DST/fullchain.pem
install -m 600 $SRC/mail.batamart.com.key $DST/privkey.pem

docker exec batamart-mail postfix reload >/dev/null 2>&1 || true
echo "$(date) certs synced"
