#!/bin/bash
# (Re)create the batamart-mail container. Data lives in /opt/batamart-mail/{data,certs}.
set -e
cd /opt/batamart-mail
docker network inspect batamart-mail-net >/dev/null 2>&1 || docker network create batamart-mail-net >/dev/null
docker rm -f batamart-mail >/dev/null 2>&1 || true
docker run -d --name batamart-mail --restart unless-stopped --network batamart-mail-net \
  -p 587:587 \
  --hostname mail.batamart.com \
  --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER --cap-add SETGID --cap-add SETUID --cap-add KILL --cap-add NET_BIND_SERVICE \
  --security-opt no-new-privileges \
  --memory 384m --cpus 1 \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  -v /opt/batamart-mail/data:/data \
  -v /opt/batamart-mail/certs:/certs:ro \
  -v batamart-mail-spool:/var/spool/postfix \
  batamart-mail:latest
