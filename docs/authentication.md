# Authentication

Convex Auth v1 is integrated with Google as the only sign-in provider.
Exact versions are pinned in the app workspace manifests. The Auth.js patch release resolves
the vulnerabilities reported for the version shown in the Convex setup guide.
V1 stores authentication tables in the application schema; it is not a component.

## Configuration

Follow the [v1 manual setup](https://labs.convex.dev/auth/setup/manual) and
[Google setup](https://labs.convex.dev/auth/config/oauth/google).

Configure these on the selected **Convex backend**, never as `VITE_` variables:

Run Convex CLI commands from `apps/backend`. Root commands such as
`npm run dev:backend` and `npm run codegen` select that workspace automatically.
The frontend's public URL configuration lives in `apps/frontend/.env.local`;
`npm run sync:frontend-env` copies only the deployment URL from backend setup.

| Variable             | Purpose                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `JWT_PRIVATE_KEY`    | Extractable RS256 private key, PKCS8 with newlines replaced by spaces |
| `JWKS`               | Matching public JWK in a `keys` array with `use: "sig"`               |
| `SITE_URL`           | Exact frontend origin, including the development port                 |
| `AUTH_GOOGLE_ID`     | Google web application's OAuth client ID                              |
| `AUTH_GOOGLE_SECRET` | That client's secret                                                  |

Generate a fresh key pair for a new deployment using the manual setup's `jose`
example. Preserve existing keys on subsequent setup runs. Keep private material
in a temporary file with mode `0600`, apply it with
`npx convex env set --from-file <file>`, and delete the file afterward. This command
refuses conflicting existing values by default; do not rotate keys incidentally.

The Google client's authorized redirect URI is the backend HTTP actions origin
plus `/api/auth/callback/google`. Its JavaScript origin must match the frontend.
For an OAuth app in testing, add the intended Google test accounts.

The local checkout uses frontend `http://127.0.0.1:5174`, backend
`http://127.0.0.1:3210`, and HTTP actions `http://127.0.0.1:3211`. Signing keys and
`SITE_URL` and Google credentials are configured locally. The Google project is
`pluribus-508119`, with a Web application client named `Pluribus local development`.
The audience is External in Testing mode with one test account. Run the frontend
with `npm run dev:frontend -- --port 5174`. If you change the port, update
`SITE_URL` and the Google client accordingly. No cloud deployment was changed.

## Behavior and verification

`ConvexAuthProvider` owns token storage and renewal. `AuthPanel` handles callback
codes once, removes auth query parameters, and displays loading and retry states.
The current-user query derives identity server-side and returns only the caller's
name and email. No user listing or workspace permissions are exposed.

Passed: type checks, 28 tests, build, local schema/function push, OIDC/JWKS
responses, signed-out profile access, and rejection of a supplied user ID.
Browser checks confirmed signed-out, canceled-return, and invalid-code recovery.
Tests with mocked identities verify profile isolation and deleted-user behavior;
they do not prove Google OAuth or session renewal.

Verified Google sign-in in Chrome against the local backend on 2026-09-09.
The callback returned an authenticated profile; reload and a second tab preserved
the session, and sign-out cleared both tabs. A second account and long-lived token
renewal remain unverified. Use an ordinary browser if Google refuses OAuth inside
an embedded browser. The full project check still reports 92 pre-existing research
formatting failures. Production branding and deployment remain unconfigured.
