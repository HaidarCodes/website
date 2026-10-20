FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03

LABEL org.opencontainers.image.title="static-portal-site"

ENV NGINX_ENTRYPOINT_QUIET_LOGS=1

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public/ /srv/www/

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
