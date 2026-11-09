# BataMart outgoing mail relay: runbook for humans and AI

Last built: 9 November 2026, on the Contabo VPS `91.90.81.1` (Ubuntu 24.04).
This folder holds the **exact files that worked**. The old server (`194.163.157.219`) was lost and the earlier
scripts were lost with it, so keep these files in git/backups.

NO secrets are in this folder. The SMTP password lives only on the server
(`/opt/batamart-mail/smtp-credentials.txt`, root-only) and in Vercel.

---------------------------------------------------------------------

## 1. What this is

BataMart (Next.js on Vercel) sends its **non-OTP emails** (order mails, broadcasts, etc.) through its own SMTP server.
This is a **sending-only** mail relay: Postfix + OpenDKIM + Cyrus SASL in one Docker container.
It does not receive mail (port 25 is closed, no MX points here).

How the site uses it (see `lib/email/sendEmail.ts`): env vars `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_SECURE` (optional), `EMAIL_FROM`. Port 587 with STARTTLS.

```
Vercel (BataMart)  --SMTP 587 + STARTTLS + AUTH-->  [ batamart-mail container on 91.90.81.1 ]
                                                       Postfix -> OpenDKIM signs -> Gmail/Yahoo/... on port 25
```

Vercel settings (enter without quotes):
```
SMTP_HOST=mail.batamart.com
SMTP_PORT=587
SMTP_USER=batamart
SMTP_PASS=<see /opt/batamart-mail/smtp-credentials.txt on the server>
EMAIL_FROM=BataMart <hello@batamart.com>
```

## 2. IMPORTANT: this server is shared with DiagSync (a medical app)

The same VPS runs DiagSync (production + dev apps, PostgreSQL with patient data, Uptime Kuma, Caddy).
Rules so you never break it:
- Everything for this relay lives in `/opt/batamart-mail/` and the Docker container `batamart-mail` on its own
  network `batamart-mail-net`. Do not touch `/var/www/*`, PM2, PostgreSQL, or ports 3000/3001/3002/5432.
- The only shared piece is **Caddy** (`/etc/caddy/Caddyfile`): it contains one small block for `mail.batamart.com`
  that exists only so Caddy obtains/renews the Let's Encrypt certificate. Edit that block only; always
  `sudo caddy validate --config /etc/caddy/Caddyfile` before `sudo systemctl reload caddy`.
- Firewall (UFW) allows 22, 80, 443, 587 (+5432 and 3001 for DiagSync). Docker publishes 587 itself.

## 3. Files in this folder

| File | Purpose |
|---|---|
| `Dockerfile` | Ubuntu 24.04 + postfix, opendkim, opendkim-tools, libsasl2-modules, sasl2-bin |
| `entrypoint.sh` | Writes all Postfix/OpenDKIM/SASL config at start, then runs both daemons; exits if either dies |
| `run.sh` | Creates the network and (re)starts the hardened container |
| `sync-certs.sh` | Copies Caddy's Let's Encrypt cert for `mail.batamart.com` into `/opt/batamart-mail/certs/` and reloads Postfix |
| `test_smtp.py` | The 9 security tests (run ON THE SERVER with `sudo python3`) |

Layout on the server:
```
/opt/batamart-mail/
  Dockerfile  entrypoint.sh  run.sh  sync-certs.sh
  data/dkim/mail.private   data/dkim/mail.txt     (DKIM key; mail.txt holds the public key for DNS)
  data/sasldb2                                    (the one SMTP user)
  certs/fullchain.pem  certs/privkey.pem          (copied from Caddy, mounted read-only)
  smtp-credentials.txt                            (SMTP_USER / SMTP_PASS, chmod 600)
```

## 4. Requirements it satisfies

- Only port **587** listens (the port-25 listener is removed from master.cf). TLS 1.2+ required before AUTH.
- One login: user `batamart`. SASL realm is `mail.batamart.com` (must equal `smtpd_sasl_local_domain`).
- Sender must end in `@batamart.com` (regexp table `sender_access`); otherwise rejected at RCPT.
- `smtpd_relay_restrictions = permit_sasl_authenticated, reject` (no open relay).
- DKIM: 2048-bit, selector `mail`, domain `batamart.com`, `milter_default_action = tempfail`
  (if the signer is down, mail is deferred, never sent unsigned).
- Limits: 20 connections, 60 conn/min, 40 msg/min, 200 rcpt/min per client; 10 MB message; queue life 2 days.
- Container: all capabilities dropped except CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID, KILL, NET_BIND_SERVICE;
  `no-new-privileges`; 384 MB; 1 CPU; `restart unless-stopped`; json-file logs 10 MB x 3.

## 5. Rebuild from scratch (what was actually run)

Run on the server as a sudo user. `$DIR=/opt/batamart-mail`.

1. **Prereqs:** Docker installed; Caddy running (for the certificate); `sudo ufw allow 587/tcp`.
2. **Copy the files:**
   ```
   sudo mkdir -p $DIR/data/dkim $DIR/certs
   # copy Dockerfile entrypoint.sh run.sh sync-certs.sh into $DIR  (strip Windows line endings: sed -i 's/\r$//' *.sh Dockerfile)
   sudo chmod +x $DIR/*.sh
   cd $DIR && sudo docker build -t batamart-mail:latest .
   ```
3. **New DKIM key:**
   ```
   sudo docker run --rm --entrypoint opendkim-genkey -v $DIR/data:/data batamart-mail:latest \
        -b 2048 -d batamart.com -s mail -D /data/dkim
   ```
   Public value for DNS: `sudo cat $DIR/data/dkim/mail.txt`, join the quoted pieces into ONE line.
4. **New SMTP password** (store it, tell the owner):
   ```
   PASS=$(openssl rand -base64 33 | tr -dc 'A-Za-z0-9' | head -c 32)
   echo "$PASS" | sudo docker run --rm -i --entrypoint saslpasswd2 -v $DIR/data:/data batamart-mail:latest \
        -p -c -f /data/sasldb2 -u mail.batamart.com batamart
   printf 'SMTP_USER=batamart\nSMTP_PASS=%s\n' "$PASS" | sudo tee $DIR/smtp-credentials.txt >/dev/null
   sudo chmod 600 $DIR/smtp-credentials.txt
   ```
5. **DNS** (owner adds at Namecheap; see section 6). The `mail` A record must exist BEFORE step 6.
6. **Certificate through Caddy.** Append to `/etc/caddy/Caddyfile`:
   ```
   mail.batamart.com {
   	respond "BataMart mail relay" 200
   }
   ```
   `sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`, wait ~10 s, then
   `sudo $DIR/sync-certs.sh`. Weekly renewal copy (root cron):
   `0 4 * * 1 /opt/batamart-mail/sync-certs.sh >> /var/log/batamart-mail-certs.log 2>&1`
7. **Start:** `sudo $DIR/run.sh` and check `sudo docker logs --tail 20 batamart-mail`.
8. **Test:** `sudo python3 test_smtp.py` must print `ALL PASSED` (section 8).
9. **One real message** to the owner's Gmail, then confirm SPF/DKIM/DMARC pass (section 8).
10. Owner sets Vercel env vars and redeploys; owner sets reverse DNS (PTR) in the Contabo panel.

## 6. DNS records (Namecheap, domain `batamart.com`)

| Type | Host | Value |
|---|---|---|
| A | `mail` | `91.90.81.1` |
| TXT | `@` | `v=spf1 ip4:91.90.81.1 ~all`  (REPLACE the old one; there must be exactly one SPF record) |
| TXT | `mail._domainkey` | `v=DKIM1; h=sha256; k=rsa; p=<public key from data/dkim/mail.txt>` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |
| (do not touch) | `@` A and `www` CNAME | they point at Vercel (the BataMart website) |

Also: **Reverse DNS (PTR)** for `91.90.81.1` -> `mail.batamart.com`, set by the owner in the Contabo customer panel
(rDNS / IP management). Without it Gmail still accepted the test mail, but other providers may spam-folder it.
Status on 9 Nov 2026: **PTR was not set yet**.

Namecheap tips: a TXT edit is only saved after clicking the green tick. Public resolvers cache for up to 30 min, so
verify against Namecheap's own server: `nslookup -type=TXT mail._domainkey.batamart.com dns1.registrar-servers.com`.
The DKIM public key in DNS must match `data/dkim/mail.private`:
`sudo docker exec batamart-mail opendkim-testkey -d batamart.com -s mail -k /data/dkim/mail.private -vvv`
("key not secure" only means no DNSSEC: normal. "key OK" is what matters.)

## 7. Mistakes already made and fixed (do not repeat)

1. **`fatal: chroot(/var/spool/postfix): Operation not permitted`**: the container has no CAP_SYS_CHROOT.
   Fix in `entrypoint.sh`: `postconf -F '*/*/chroot = n'`.
2. **TLS warning: both `smtpd_tls_chain_files` and legacy `smtpd_tls_cert_file` set**: Ubuntu's default main.cf
   sets snakeoil cert files. Fix: set `smtpd_tls_cert_file`, `smtpd_tls_key_file` (and ec/d variants) to empty.
3. **`fatal: unexpected command-line argument: regexp:...`**: values of `-o` in master.cf cannot contain spaces.
   Fix: put the list in a main.cf parameter (`submission_sender_restrictions`) and reference it in master.cf.
4. **Silent security bug:** the master.cf is written with an unquoted heredoc, so `$submission_sender_restrictions`
   expanded to EMPTY and the sender check was disabled (a spoofed `@gmail.com` sender was accepted). It must be
   written as `\$submission_sender_restrictions` in `entrypoint.sh`. The spoof test caught this; keep that test.
5. Sender restrictions run at **RCPT** time (`smtpd_delay_reject = yes`). A test of the sender rule must send RCPT,
   not just MAIL FROM.
6. Windows line endings (CRLF) break the shell scripts: always `sed -i 's/\r$//'`.
7. Do not run the tests from the owner's Windows laptop: its `python3` is a Store stub that hangs. Run on the server.
8. Cosmetic, ignore: `postfix: not set-gid ... postqueue/postdrop` (local sendmail is not used) and
   `unused parameter: submission_sender_restrictions` warnings, and Docker's "legacy builder is deprecated".

## 8. Tests

`sudo python3 test_smtp.py` (reads the password from `/opt/batamart-mail/smtp-credentials.txt`). Expected:
```
PASS STARTTLS offered
PASS AUTH not offered before TLS
PASS login before TLS refused
PASS unauthenticated relay refused
PASS wrong password refused
PASS correct password works
PASS sender spoof@gmail.com refused
PASS sender support@batamart.com accepted
PASS port 25 closed
ALL PASSED
```
Real-mail check: send ONE message through `mail.batamart.com:587` (STARTTLS + AUTH) to the owner's Gmail, open
"Show original": `SPF: PASS`, `DKIM: PASS` (header.s=mail), `DMARC: PASS`. This passed on 9 Nov 2026, and the message
landed in the Inbox (not spam).

## 9. Day-to-day

```
sudo docker logs --since 30m batamart-mail | grep status=      # delivery results (sent / deferred / bounced)
sudo docker ps --filter name=batamart-mail                     # is it up?
sudo docker exec batamart-mail postqueue -p                    # queued/deferred mail (needs the cap list as-is)
sudo $DIR/run.sh                                               # recreate the container (config comes from entrypoint.sh)
sudo $DIR/sync-certs.sh                                        # refresh the TLS cert now
```
Config changes: edit `entrypoint.sh` (it regenerates everything at every start), then
`sudo docker build -t batamart-mail:latest . && sudo ./run.sh`. Do NOT hand-edit files inside the container.

Rotate the SMTP password (no restart needed): run the `saslpasswd2` command from step 4 of section 5 with the new
value, update `smtp-credentials.txt`, then update `SMTP_PASS` on Vercel and redeploy.
Rotate DKIM: generate a new key (new selector, e.g. `mail2`), publish its DNS record first, wait for propagation,
then switch `Selector`/key paths in `entrypoint.sh`, rebuild, run, and delete the old record later.

## 10. Troubleshooting

| Symptom | Check |
|---|---|
| Site says email failed | `docker logs ... | grep -E "status=|warning|fatal"`; is the container up; is `SMTP_PASS` current on Vercel |
| `535 authentication failed` | wrong password, or realm mismatch (realm must be `mail.batamart.com`) |
| `Connection closed` right after connect | smtpd crashing: read the logs for `fatal:` (see section 7) |
| Mail goes to spam | PTR record missing, SPF/DKIM not matching the current IP/key, or a new domain with no reputation |
| `dkim=fail` / `body hash` | DKIM DNS key does not match `mail.private` (run `opendkim-testkey`) |
| Deferred with `451 ... milter` | OpenDKIM not running; the container should have restarted by itself |
| Cert expired | `sudo $DIR/sync-certs.sh`; confirm Caddy still manages `mail.batamart.com` |

## 11. State at the time of writing (9 Nov 2026)

- Relay running, 9/9 tests passed, SPF/DKIM/DMARC pass at Gmail.
- Owner still had to: set the PTR record in Contabo, and put the new `SMTP_*` values into Vercel + redeploy.
- Not monitored yet: add a TCP check on `91.90.81.1:587` in Uptime Kuma (http://91.90.81.1:3001).
- DiagSync details (the other app on this server) are in `C:\Users\USER\Documents\DiagSync Hosting Guide.md`.
