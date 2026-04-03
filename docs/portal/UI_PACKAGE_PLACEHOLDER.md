# Shared UI package (deferred)

`@carwoods/ui` was omitted from npm workspaces because **symlinked workspaces fail on some Windows network drives** (e.g. UNC-mapped `Z:`). Re-introduce `packages/ui` with a `package.json` when the repo is cloned on a path that supports npm symlinks, or when using npm settings that avoid workspace symlinks.

Until then, keep shared portal components colocated or under `apps/web` once the Vite app moves into a workspace package.
