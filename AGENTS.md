## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context layout. See `docs/agents/domain.md`.

### Local development server

- Before starting the Next.js dev server, check whether `http://localhost:3000` is already listening and responding as this app. If it is, use that server for testing; do not start a second dev server.
  - If your changes require a server restart, coordinate with the existing server process to avoid conflicts. If you don't have permission to control the existing server, inform the user and request guidance before proceeding.
- If port 3000 is occupied but the app is not responding as expected, or the existing server's state is unclear, tell the user and ask before starting, stopping, or replacing a server. Do not terminate the user's process.
- This matters especially for Electrolux: dev server processes can refresh and persist tokens to the same encrypted token store. See `docs/electrolux.md`.