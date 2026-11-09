FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN echo "postfix postfix/mailname string mail.batamart.com" | debconf-set-selections && \
    echo "postfix postfix/main_mailer_type string 'Internet Site'" | debconf-set-selections && \
    apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends postfix opendkim opendkim-tools libsasl2-modules sasl2-bin ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN chgrp postdrop /usr/sbin/postqueue /usr/sbin/postdrop && chmod 2555 /usr/sbin/postqueue /usr/sbin/postdrop
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 587
ENTRYPOINT ["/entrypoint.sh"]
