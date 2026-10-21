#!/bin/sh
set -eu

fail() {
  printf '%s\n' "Branding configuration error: $1" >&2
  exit 1
}

site_name="${PUBLIC_SITE_NAME-}"
contact_email="${PUBLIC_CONTACT_EMAIL-}"

[ -n "$site_name" ] || fail "PUBLIC_SITE_NAME is required."
[ -n "$contact_email" ] || fail "PUBLIC_CONTACT_EMAIL is required."

case "$site_name" in
  *[!A-Za-z0-9.-]*)
    fail "PUBLIC_SITE_NAME must contain only ASCII letters, digits, dots and hyphens; no URL scheme, spaces or line breaks."
    ;;
esac
[ "${#site_name}" -le 253 ] || fail "PUBLIC_SITE_NAME must be at most 253 characters."

case "$contact_email" in
  *[!A-Za-z0-9._%+@-]*)
    fail "PUBLIC_CONTACT_EMAIL must be a plain ASCII email address; no mailto: prefix, display name, spaces or line breaks."
    ;;
esac
[ "${#contact_email}" -le 254 ] || fail "PUBLIC_CONTACT_EMAIL must be at most 254 characters."
printf '%s' "$contact_email" | grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' \
  || fail "PUBLIC_CONTACT_EMAIL must match local-part@domain.tld with an alphabetic suffix of at least two letters."
