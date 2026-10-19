# Deployment checklist

## GitHub Pages frontend

1. Commit the project files, including `public/soc-playbooks-backup.json`, to the repository that hosts SOC Playbook Studio.
2. Confirm the GitHub Pages source branch is the same branch configured as `GITHUB_BRANCH` in `backend/wrangler.toml` (or update the variable accordingly).
3. Keep the `public/soc-playbooks-backup.json` file in the repository. The API writes updates to this path.

## Cloudflare Worker API

Follow `backend/README.md` to create a fine-grained GitHub token, set Worker secrets, configure the repository owner/name/branch and exact site origin, then deploy the Worker.

## Connect frontend

In `src/js/config.js`, set:

```js
apiBaseUrl: 'https://YOUR-WORKER-URL.workers.dev',
demoMode: false,
```

Commit and redeploy the frontend. The GitHub token must never appear in this file.

## Smoke test

- Open `https://YOUR-WORKER-URL.workers.dev/api/health`.
- Open the website and sign in with the server-side admin username/password.
- Use **Shared JSON** in the left navigation and confirm it loads the central JSON.
- Create a temporary test playbook and save it.
- Confirm the repository shows a new commit changing `public/soc-playbooks-backup.json`.
- Open the site on another browser/device and confirm the playbook appears.
- Confirm a local user can use playbooks but cannot create, edit, import, or delete definitions.

## If a write fails

- `401`: sign in again; the admin session may have expired.
- `403`: token/repository permissions or API access may be wrong.
- `404`: check `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, and `GITHUB_PATH`.
- `409`/`422`: another commit may have changed the file. Refresh Shared JSON and retry.
- Browser CORS error: add the exact website origin (scheme + hostname + optional port, no path) to `ALLOWED_ORIGIN` and redeploy the Worker.
