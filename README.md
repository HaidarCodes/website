# Static Portal Landing Page

A minimal coming-soon page with a procedural, interactive End Portal-inspired background.

[English](README.md) | [Deutsch](README.de.md)

## Easy to extend

The page is made to be easily expandable: HTML, CSS, and small native JavaScript modules are kept
separate, with no application framework or build step. New sections and interactions can be added
incrementally without replacing the existing setup.

## Development

Requires Node.js 22.13 or later.

```sh
npm ci
npm run lint
npm run check
npm test
npm run preview
```

The container preview uses neutral placeholder values; production branding is not stored locally.

## Why Docker?

Docker is not required to serve this static site; any suitable web server can host `public/`.
The container is used because it fits the existing proxy and deployment setup, packages nginx and
the site as one reproducible release, and runs with a read-only filesystem and an unprivileged user.

## Deployment

GitHub Actions checks pull requests and pushes to `main`. Automatic deployment requires a Linux
self-hosted runner with Docker and a protected `production` environment. Add `PUBLIC_SITE_NAME` and
`PUBLIC_CONTACT_EMAIL` as environment secrets. BuildKit uses them to render the site; the values
appear in the public page, so only use values intended for publication.

The container is available on the external Compose network `proxy` at `static-portal-site:8080`.

## Note

The background is inspired by Minecraft but uses no Mojang or Microsoft textures or code. This
project is not affiliated with Mojang Studios or Microsoft.
