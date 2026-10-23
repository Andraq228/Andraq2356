# Labspace

Public laboratory catalog with anonymous downloads and administrator publishing.

## Run

Requires Node.js 18 or newer. No dependencies are needed.

```powershell
$env:ADMIN_PASSWORD = "your-private-password"
$env:LABSPACE_STORAGE_DIR = "./storage"
$env:PORT = "4181"
node server.js
```

Open http://localhost:4181. The administrator entry is in the top-right corner.
Visitors can browse and download without an account. Administrator sessions use
an HttpOnly cookie and expire after 24 hours or a server restart.

Published metadata is stored in `.data/labs.json`; uploaded files are stored in
`uploads/`. Keep both directories when moving the site to a host with persistent
disk storage. Only the four frontend assets and public uploads should be served.

When a host provides a mounted disk, set `LABSPACE_STORAGE_DIR` to that mount
path (for example `/var/data`). The server will keep `.data/` and `uploads/`
inside it.

For an Internet deployment, set `ADMIN_PASSWORD` and use HTTPS. A temporary tunnel
works only while this computer and the Node server remain running. A permanent
deployment needs a Node host with persistent storage.
