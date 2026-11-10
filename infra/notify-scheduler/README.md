# BataMart notification scheduler (VPS)

Vercel only runs daily crons, so the six daily campaign slots are triggered from the VPS. Each slot is one `POST /api/cron/notify-slot?slot=N` with the header `x-slot-secret`.

| Slot | Lagos time | What it sends |
|------|-----------|---------------|
| 1 | 07:45 | Top personalised product |
| 2 | 10:30 | Hot deal with the exact % off (also carries the one marketing email of the day) |
| 3 | 13:00 | Something you viewed, or a real deal / trending item |
| 4 | 16:00 | New arrival or trending item in your category |
| 5 | 19:00 | Cart reminder, else first-order nudge, else a recommendation |
| 6 | 21:00 | Order tonight for the next delivery day (real cutoff) |

## One-time setup (done by the owner's assistant)

1. In Vercel, set `SLOT_CRON_SECRET` (a long random string, e.g. `openssl rand -hex 32`) and optionally `EMAIL_DAILY_BUDGET` (default 150). Redeploy.
2. On the VPS:
   ```
   sudo useradd --system --no-create-home batamart-notify
   sudo mkdir -p /opt/batamart-notify /etc/batamart
   sudo cp notify-slot.sh /opt/batamart-notify/ && sudo chmod 755 /opt/batamart-notify/notify-slot.sh
   sudo cp notify-scheduler.env.example /etc/batamart/notify-scheduler.env
   sudo nano /etc/batamart/notify-scheduler.env          # real URL + secret
   sudo chown root:batamart-notify /etc/batamart/notify-scheduler.env
   sudo chmod 640 /etc/batamart/notify-scheduler.env
   ```
3. Install the timers (systemd, recommended; they use `Africa/Lagos` directly so the server clock does not matter):
   ```
   sudo cp batamart-notify-slot@.service batamart-notify-slot@*.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now batamart-notify-slot@{1,2,3,4,5,6}.timer
   systemctl list-timers 'batamart-notify-slot@*'
   ```
   Or use `crontab.example` instead (server clock must be UTC).
4. Test one slot by hand (after 07:00 and before 22:00 Lagos, or pushes are held back by quiet hours):
   ```
   sudo -u batamart-notify /opt/batamart-notify/notify-slot.sh 1
   journalctl -u 'batamart-notify-slot@1' -n 20
   ```

## Behaviour to know

- Safe to run twice: each person gets each slot at most once a day, and a slot that finished answers `"alreadyDone":true`.
- A big day may not fit in one 50 second call. The endpoint answers `"done":false` and the script calls again (up to 8 times).
- HTTP 401 means the secret differs from Vercel; 503 means `SLOT_CRON_SECRET` is not set on Vercel.
- Results per slot and day (sent, skipped for cap / quiet hours / opt-out, emails against budget): admin API `GET /api/admin/notifications/campaign-stats`.
