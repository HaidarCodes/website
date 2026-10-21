FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03

LABEL org.opencontainers.image.title="static-portal-site"

ENV NGINX_ENTRYPOINT_QUIET_LOGS=1

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public/ /srv/www/

USER root
RUN --mount=type=secret,id=public_site_name,required=false \
    --mount=type=secret,id=public_contact_email,required=false \
    --mount=type=bind,source=scripts/validate-branding.sh,target=/tmp/validate-branding.sh \
    set -eu; \
    site_name="Website"; \
    contact_email="contact@example.invalid"; \
    if [ -f /run/secrets/public_site_name ]; then \
      site_name="$(cat /run/secrets/public_site_name; printf '.')"; \
      site_name="${site_name%.}"; \
    fi; \
    if [ -f /run/secrets/public_contact_email ]; then \
      contact_email="$(cat /run/secrets/public_contact_email; printf '.')"; \
      contact_email="${contact_email%.}"; \
    fi; \
    PUBLIC_SITE_NAME="$site_name" PUBLIC_CONTACT_EMAIL="$contact_email" \
      sh /tmp/validate-branding.sh; \
    sed -e "s|@@SITE_NAME@@|$site_name|g" \
        -e "s|@@CONTACT_EMAIL@@|$contact_email|g" \
        /srv/www/index.html > /tmp/index.html; \
    mv /tmp/index.html /srv/www/index.html

USER 101

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
