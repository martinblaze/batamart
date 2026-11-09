import smtplib, ssl, sys, socket
PASS=open('/opt/batamart-mail/smtp-credentials.txt').read().split('SMTP_PASS=')[1].strip()
H="mail.batamart.com"; ctx=ssl.create_default_context()
def conn():
    s=smtplib.SMTP(H,587,timeout=20); s.ehlo(); return s
r=[]
def t(name,ok,detail=""): r.append(ok); print(("PASS " if ok else "FAIL ")+name+(" - "+detail if detail else ""))

# 1. STARTTLS offered, and AUTH not offered before TLS
s=conn(); t("STARTTLS offered", s.has_extn("starttls")); t("AUTH not offered before TLS", not s.has_extn("auth"))
# 2. login before TLS refused
try: s.login("batamart",PASS); t("login before TLS refused",False)
except smtplib.SMTPException as e: t("login before TLS refused",True,str(e)[:60])
s.close()
# 3. unauthenticated send to outside refused
s=conn(); s.starttls(context=ctx); s.ehlo()
try: s.mail("support@batamart.com"); c,m=s.rcpt("someone@gmail.com"); t("unauthenticated relay refused", c>=500 or c==454, f"{c} {m[:50]}")
except smtplib.SMTPException as e: t("unauthenticated relay refused",True,str(e)[:60])
s.close()
# 4. wrong password refused
s=conn(); s.starttls(context=ctx); s.ehlo()
try: s.login("batamart","wrong-password"); t("wrong password refused",False)
except smtplib.SMTPAuthenticationError as e: t("wrong password refused",True,str(e)[:40])
s.close()
# 5. correct password works
s=conn(); s.starttls(context=ctx); s.ehlo()
try: s.login("batamart",PASS); t("correct password works",True)
except Exception as e: t("correct password works",False,str(e)); sys.exit(1)
# 6. spoofed sender refused at MAIL/RCPT, 7. batamart sender accepted (no DATA sent)
try: c,m=s.mail("spoof@gmail.com"); 
except smtplib.SMTPException as e: c,m=getattr(e,'smtp_code',0),str(e)
if c<400:
    c2,m2=s.rcpt("martinchidozie27@gmail.com"); c=c2 if c2>=400 else 250; m=m2
t("sender spoof@gmail.com refused", c>=500, f"{c} {str(m)[:50]}")
s.rset()
c,m=s.mail("support@batamart.com"); t("sender support@batamart.com accepted", c==250, f"{c}")
s.rset(); s.quit()
# 8. port 25 closed
x=socket.socket(); x.settimeout(4)
t("port 25 closed", x.connect_ex((H,25))!=0)
print("\nALL PASSED" if all(r) else "\nSOME TESTS FAILED")
