# SOC Playbook Studio — VS Code project

A multi-file SOC incident analysis workspace with a parser, dynamic field mapping, playbook workspace/library, investigation apps, incident handoff tools, and role-based UI. The central playbook source is the JSON file committed in this project repository.

## Local development

```bash
npm install
npm run start
```

Open the local URL printed by Vite. The central API can be deployed separately; see `backend/README.md`.

## Shared playbooks across devices

GitHub Pages is a static host and cannot let browser JavaScript write to the repository directly. This project therefore includes a Cloudflare Worker API in `backend/worker.js` which:

1. Authenticates the administrator server-side and issues a signed, expiring session.
2. Reads `public/soc-playbooks-backup.json` from the project repository.
3. Accepts playbook writes only from a valid admin session.
4. Commits the updated JSON file to the repository with GitHub's Contents API.
5. Serves the same central library to all devices through `/api/playbooks`.

Follow `backend/README.md` to configure the GitHub repository, create a fine-grained token, set Cloudflare Worker secrets, deploy the Worker, and connect the frontend.

After the Worker is deployed, set `apiBaseUrl` in `src/js/config.js` to its URL. `demoMode` is disabled by default, so admin login intentionally stays unavailable until the API is configured. Never place a GitHub token, admin password, or session secret in any frontend file.

## Roles

- **Local user:** can access enabled tools, browse and use playbooks, and change case-specific values. Playbook definitions cannot be created, edited, deleted, or imported by local users.
- **Administrator:** can create/edit/delete/import playbooks, control feature availability, and inspect the read-only Shared JSON panel in the left navigation.
- Admin creation/edit/import/delete changes and feature-permission toggles are sent to the central API and committed to `public/soc-playbooks-backup.json`. Devices load the central source on startup; changes to feature permissions are applied on their next load/refresh.

## Important storage distinction

`localStorage`, the optional browser folder picker, and the JSON export are local-device conveniences/backups. They do not synchronize other devices. The Cloudflare Worker + GitHub Contents API is the shared source of truth. If an existing device has custom playbooks, the admin Shared JSON panel includes a migration action to merge its local custom playbooks into the central library.

## JSON file

`public/soc-playbooks-backup.json` contains the initial four playbooks and is the canonical repository file. It should contain playbook definitions only—never credentials, API keys, or other secrets. If the repository is public, the JSON is publicly readable even though the in-app JSON preview is shown only to administrators.

## Security

Browser-only demo credentials are not secure authentication. Once the Worker is configured, set `demoMode: false`; the admin login will then use the server-side API. The GitHub token, admin password, and session signing secret belong only in Cloudflare Worker secrets. Restrict the GitHub token to this repository and Contents read/write permission. The Worker validates the admin session on every write.

See `backend/README.md` for deployment and verification steps.
