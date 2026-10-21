# Statische Portal-Startseite

Eine minimale Coming-soon-Seite mit prozeduralem, interaktivem End-Portal-Hintergrund.

[English](README.md) | [Deutsch](README.de.md)

## Einfach erweiterbar

Die Seite ist bewusst einfach erweiterbar: HTML, CSS und kleine native JavaScript-Module sind
getrennt und kommen ohne Framework oder Build-Schritt aus. Neue Bereiche und Interaktionen lassen
sich ergänzen, ohne das bestehende Setup ersetzen zu müssen.

## Entwicklung

Voraussetzung: Node.js 22.13 oder neuer.

```sh
npm ci
npm run lint
npm run check
npm test
npm run preview
```

Die Container-Vorschau nutzt neutrale Beispielwerte; Produktionswerte werden nicht lokal gespeichert.

## Warum Docker?

Für eine statische Seite ist Docker nicht erforderlich; ein geeigneter Webserver kann `public/`
direkt ausliefern. Der Container passt zur vorhandenen Proxy- und Deployment-Umgebung, bündelt
nginx und Website als reproduzierbares Release und läuft mit schreibgeschütztem Dateisystem und
unprivilegiertem Nutzer.

## Deployment

GitHub Actions prüft Pull Requests und Pushes auf `main`. Für automatische Deployments braucht das
Repository einen Linux-Self-Hosted-Runner mit Docker und ein geschütztes Environment `production`.
Lege `PUBLIC_SITE_NAME` und `PUBLIC_CONTACT_EMAIL` dort als Secrets an. BuildKit rendert damit die
Seite; die Werte sind anschließend öffentlich sichtbar und müssen zur Veröffentlichung bestimmt sein.

| Secret | Beispiel |
| --- | --- |
| `PUBLIC_SITE_NAME` | `example.invalid` |
| `PUBLIC_CONTACT_EMAIL` | `contact@example.invalid` |

Werte ohne Anführungszeichen, umgebende Leerzeichen, Zeilenumbrüche, `https://` oder `mailto:` eingeben.
Ungültige Konfiguration stoppt das Deployment mit Variablenname und erwartetem Format, nie mit dem Wert.
Nach einer Secret-Korrektur in GitHub Actions **Re-run failed jobs** wählen; ein neuer Commit ist nicht nötig.

Das Deployment baut und startet den Container auf dem Docker-Host des Runners, nicht bei GitHub.
Das externe Compose-Netz `proxy` muss bereits existieren; der Reverse Proxy erreicht den Container
unter `static-portal-site:8080`, ohne veröffentlichten Host-Port.

Den Deployment-Runner als eigenen Nicht-root-Dienstbenutzer betreiben, nicht als persönlichen Admin.
Docker-Zugriff entspricht praktisch root-Zugriff: Nicht vertrauenswürdige PR-Jobs bleiben auf GitHub-Runnern.
Im konfigurierten Runner-Verzeichnis installieren und starten `sudo ./svc.sh install RUNNER_USER` und
`sudo ./svc.sh start` den Dienst samt Autostart; prüfen mit `sudo ./svc.sh status`.

## Hinweis

Der Hintergrund ist von Minecraft inspiriert, verwendet aber keine Texturen oder keinen Code von
Mojang oder Microsoft. Das Projekt ist nicht mit Mojang Studios oder Microsoft verbunden.
