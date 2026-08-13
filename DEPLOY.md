# Deploying to Caddy at `/projects/asett/`

The app ships as a single container: one Node process serving the API **and** the built client.
Caddy strips the `/projects/asett` prefix and forwards to it, matching the pattern the other
projects on the domain already use.

---

## 1. Build argument, and why it matters

`VITE_BASE_PATH` is a **build-time** argument, not a runtime environment variable. Vite writes it
into the asset URLs inside `index.html`, so it cannot be changed after the image is built. It has
to end with a slash.

It drives three things that must agree (`client/src/basePath.js`):

| | If wrong |
| --- | --- |
| Asset URLs in `index.html` | Browser 404s on the JS bundle — blank page |
| React Router `basename` | In-app links leave the app and land on your portfolio |
| API request prefix | Every `fetch` hits the wrong path |

---

## 2. Compose service

Add to your `docker-compose.yml`, on the same network Caddy uses:

```yaml
services:
  asett:
    build:
      context: ./asett-complaints        # wherever you clone this repo
      args:
        VITE_BASE_PATH: /projects/asett/ # trailing slash required
    environment:
      NODE_ENV: production
      PORT: 3001
      ASETT_DB_PATH: /data/asett.db
      ASETT_DEMO_MODE: "true"          # see below — required for the demo to be usable
    volumes:
      - asett-data:/data
    restart: unless-stopped
    # No `ports:` — Caddy reaches it over the compose network. Nothing is
    # published to the host.

volumes:
  asett-data:
```

The database lives at `/data`, **outside** the app tree. Mounting a volume over
`server/db/` would hide `schema.sql` and `seed.js`, which live there.

### `ASETT_DEMO_MODE`

Filing is gated on email verification, and there is no mail server. With
`ASETT_DEMO_MODE=true` the API returns the six-digit code and the UI displays it, so a visitor can
complete a filing.

It is a **separate flag from `NODE_ENV` on purpose.** The hosted demo runs in production mode — CORS
off, built client served — but still has nowhere to send mail. Deriving this from `NODE_ENV` (the
first version) made the deployed app impossible to use: the code was suppressed *and* no email
arrived, so verification could never be completed. Set it to `false` the moment real delivery is
configured; the code then stops being returned or logged.

The container seeds on start; the seed script is a no-op when rows already exist, so restarts and
redeploys keep whatever is in the volume.

---

## 3. Caddyfile block

Add inside the existing `sumit-gupta.cloud, www.sumit-gupta.cloud { … }` site block, **above** the
final `handle { reverse_proxy portfolio:3000 }` — that one is a catch-all and will swallow anything
placed after it.

```caddyfile
	# ASETT complaints
	redir /projects/asett /projects/asett/ 308
	handle_path /projects/asett/* {
		reverse_proxy asett:3001 {
			header_up Host {host}
			header_up X-Forwarded-Host {host}
			header_up X-Forwarded-Proto {scheme}
		}
	}
```

`handle_path` (not `handle`) is deliberate: it strips the prefix, so Express serves from `/`
internally while the browser stays on `/projects/asett/…`. The `redir` handles someone typing the
path without a trailing slash.

---

## 4. Deploy

```bash
docker compose up -d --build asett
```

```bash
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Then check it:

```bash
curl -sS https://sumit-gupta.cloud/projects/asett/api/health
```

That should return `{"ok":true}`. If it returns portfolio HTML instead, the Caddy block is below
the catch-all `handle`.

---

## 5. Operations

Reset the demo data to the seeded eight complaints:

```bash
docker compose exec asett node server/db/seed.js --reset
```

Wipe everything, including anything filed through the live demo:

```bash
docker compose down asett && docker volume rm <project>_asett-data && docker compose up -d asett
```

Tail the logs:

```bash
docker compose logs -f asett
```

---

## Notes

- **Reviewer tokens are in process memory**, so a redeploy signs the reviewer out. The client
  handles this: a 401 clears the local token and returns to the sign-in screen.
- **`NODE_ENV=production` disables CORS**, which is correct here — the client is served from the
  same origin as the API.
- **Back up the volume** if the filed complaints matter: `docker run --rm -v <project>_asett-data:/d
  -v $PWD:/out alpine tar czf /out/asett-backup.tar.gz -C /d .`
- **The container runs as the non-root `node` user** and publishes no host ports.
- **To serve from a different path**, change `VITE_BASE_PATH`, the `redir`, and the `handle_path`
  together, and rebuild the image — the path is compiled into the bundle.
