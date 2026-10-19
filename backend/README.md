# Central GitHub JSON API (Cloudflare Worker)

This API allows the static GitHub Pages app to read the shared JSON file publicly and update it only with a server-validated admin session. The GitHub token and admin password stay in Cloudflare Worker secrets; they must never be placed in `src/js/config.js`.

## Before first deployment: preserve existing custom playbooks

If your current `FileHosting` repository or a browser contains custom playbooks, do not overwrite that data with the starter JSON. Copy the existing `soc-playbooks-backup.json` contents into `public/soc-playbooks-backup.json` before deploying the Worker, or open the site on the device that still has the local custom playbooks and use **Merge local custom playbooks** in the admin Shared JSON panel after the API is connected. That migration button merges custom entries not already present in the central file. Keep an export backup first.

## 1. Create a GitHub token

Create a **fine-grained personal access token** limited to the repository containing this project. Grant **Contents: Read and write**. Use the narrowest repository access possible. Do not paste the token into the website or commit it to GitHub.

## 2. Configure the Worker

Install Node.js, then from this `backend` directory:

```bash
npx wrangler login
```

Edit `wrangler.toml`:

- `GITHUB_OWNER`: repository owner.
- `GITHUB_REPO`: repository name for the SOC Playbook Studio project (not the old file-hosting repo unless that is where the project itself lives).
- `GITHUB_PATH`: `public/soc-playbooks-backup.json` by default.
- `GITHUB_BRANCH`: the branch receiving GitHub Pages source commits.
- `ALLOWED_ORIGIN`: exact GitHub Pages origin, without a path; add a custom domain if you use one.

Set secrets interactively:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

For `SESSION_SECRET`, use a randomly generated secret of at least 32 characters. For `ADMIN_PASSWORD`, use a unique strong password. `ADMIN_USERNAME` is set in `wrangler.toml`.

Deploy:

```bash
npx wrangler deploy
```

Wrangler prints the Worker URL, for example `https://soc-playbook-studio-api.<account>.workers.dev`.

## 3. Connect the frontend

Set `apiBaseUrl` in `src/js/config.js` to the Worker URL (no trailing slash). Set `demoMode: false`. Commit and deploy the frontend. Never place the GitHub token in frontend config.

## 4. Verify

Open `<WORKER_URL>/api/health` and confirm it returns `{ "ok": true, ... }`. Then load the app, sign in as admin, and use **Shared JSON** in the sidebar. The first read should show the contents of `public/soc-playbooks-backup.json` from the configured repository. Create a small test playbook; the API should commit a new version of that JSON file to GitHub. Open the same site on another device and refresh.

## Notes

- The Worker uses GitHub's Contents API and commits the JSON file to the configured branch. This is the actual persistent, shared source of truth.
- A successful commit to the GitHub Pages source branch may trigger a normal Pages deployment depending on your Pages setup. The app reads via the Worker, so it does not need to wait for deployment to load the latest data.
- The JSON file is in the repository and can be public if the repository is public. The admin-only JSON preview is a UI restriction, not confidentiality for the underlying playbooks. Do not store secrets in playbooks.
- The Worker checks the signed admin session before any write. The frontend hides write controls from local users as an additional usability layer.
- Concurrent writes can conflict; on a conflict, refresh the shared JSON and retry. This implementation reports the conflict rather than silently overwriting another commit.
- If your GitHub Pages deployment uses a custom domain, include that exact origin in `ALLOWED_ORIGIN`.
