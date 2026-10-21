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

## Deployment

GitHub Actions checks pull requests and pushes to `main`. Automatic deployment requires a Linux
self-hosted runner with Docker and a protected `production` environment. Add `PUBLIC_SITE_NAME` and
`PUBLIC_CONTACT_EMAIL` as environment secrets. BuildKit uses them to render the site; the values
appear in the public page, so only use values intended for publication.

| Secret | Example |
| --- | --- |
| `PUBLIC_SITE_NAME` | `example.com` |
| `PUBLIC_CONTACT_EMAIL` | `contact@example.com` |

Enter values without quotes, surrounding whitespace, line breaks, `https://` or `mailto:`.
Invalid configuration stops deployment with the variable name and expected format, never its value.

Deployment builds and starts the container on the runner's Docker host, not on GitHub.
The external Compose network `proxy` must already exist; the reverse proxy reaches the container
at `static-portal-site:8080`, with no host port published.


## Note

The background is inspired by Minecraft but uses no Mojang or Microsoft textures or code. This
project is not affiliated with Mojang Studios or Microsoft.
