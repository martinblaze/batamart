#!/bin/bash
# Outgoing-only mail relay for batamart.com: Postfix (587 only) + OpenDKIM + Cyrus SASL (sasldb)
set -e
DOMAIN=batamart.com
HOST=mail.batamart.com

# ---- OpenDKIM (signing only; tempfail if the signer is down) ----
mkdir -p /etc/opendkim/keys/$DOMAIN /var/run/opendkim
cat > /etc/opendkim.conf <<C
Syslog                  no
LogWhy                  yes
Mode                    s
Canonicalization        relaxed/relaxed
Domain                  $DOMAIN
Selector                mail
KeyFile                 /data/dkim/mail.private
SigningTable            refile:/etc/opendkim/signing.table
KeyTable                refile:/etc/opendkim/key.table
Socket                  inet:8891@127.0.0.1
PidFile                 /var/run/opendkim/opendkim.pid
UserID                  opendkim
UMask                   007
C
echo "*@$DOMAIN mail._domainkey.$DOMAIN" > /etc/opendkim/signing.table
echo "mail._domainkey.$DOMAIN $DOMAIN:mail:/data/dkim/mail.private" > /etc/opendkim/key.table
sed -i '/^KeyFile/d' /etc/opendkim.conf
chown -R opendkim:opendkim /data/dkim; chmod 700 /data/dkim; chmod 600 /data/dkim/mail.private

# ---- SASL ----
mkdir -p /etc/postfix/sasl
cat > /etc/postfix/sasl/smtpd.conf <<C
pwcheck_method: auxprop
auxprop_plugin: sasldb
sasldb_path: /data/sasldb2
mech_list: PLAIN LOGIN
C
[ -f /data/sasldb2 ] && { chown root:postfix /data/sasldb2; chmod 640 /data/sasldb2; }

# ---- Postfix ----
cat > /etc/postfix/sender_access <<C
/@batamart\.com\$/i    OK
/./                    REJECT Sender address not allowed
C
postconf -e "myhostname = $HOST" "mydomain = $DOMAIN" "myorigin = $DOMAIN" \
  "inet_interfaces = all" "inet_protocols = ipv4" "mydestination =" "mynetworks = 127.0.0.0/8" \
  "local_recipient_maps =" "smtp_helo_name = $HOST" \
  "maillog_file = /dev/stdout" \
  "smtpd_tls_chain_files = /certs/privkey.pem, /certs/fullchain.pem" \
  "smtpd_tls_protocols = >=TLSv1.2" "smtpd_tls_mandatory_protocols = >=TLSv1.2" \
  "smtpd_tls_security_level = may" "smtp_tls_security_level = may" "smtpd_tls_loglevel = 1" \
  "smtpd_sasl_type = cyrus" "smtpd_sasl_path = smtpd" "smtpd_sasl_local_domain = $HOST" \
  "smtpd_sasl_security_options = noanonymous" "broken_sasl_auth_clients = yes" \
  "smtpd_relay_restrictions = permit_sasl_authenticated, reject" \
  "smtpd_recipient_restrictions = permit_sasl_authenticated, reject" \
  "smtpd_client_connection_count_limit = 20" "smtpd_client_connection_rate_limit = 60" \
  "smtpd_client_message_rate_limit = 40" "smtpd_client_recipient_rate_limit = 200" \
  "smtpd_client_event_limit_exceptions =" \
  "message_size_limit = 10485760" "maximal_queue_lifetime = 2d" "bounce_queue_lifetime = 2d" \
  "milter_default_action = tempfail" "milter_protocol = 6" \
  "smtpd_milters = inet:127.0.0.1:8891" "non_smtpd_milters = inet:127.0.0.1:8891" \
  "disable_vrfy_command = yes" "smtpd_helo_required = yes"
postconf -e 'submission_sender_restrictions = reject_non_fqdn_sender, check_sender_access regexp:/etc/postfix/sender_access'
postconf -F '*/*/chroot = n'
postconf -e 'smtpd_tls_cert_file =' 'smtpd_tls_key_file =' 'smtpd_tls_eccert_file =' 'smtpd_tls_eckey_file =' 'smtpd_tls_dcert_file =' 'smtpd_tls_dkey_file ='
# Only the submission service listens: remove the port-25 smtpd listener, define port 587
sed -i -E '/^smtp[[:space:]]+inet/d' /etc/postfix/master.cf
cat >> /etc/postfix/master.cf <<C
submission inet n       -       n       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_tls_auth_only=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_sender_restrictions=\$submission_sender_restrictions
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
C
postfix set-permissions >/dev/null 2>&1 || true
postfix check

# Run both; if either dies, exit so Docker restarts the container (never send unsigned mail)
opendkim -f -x /etc/opendkim.conf &
sleep 2
postfix start-fg &
wait -n
exit 1
