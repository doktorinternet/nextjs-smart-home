# Spotify account authorization

This server-side foundation uses Spotify's Authorization Code flow. It does not create a Spotify app or contact Spotify until a user opens `/api/spotify/auth/start`.

## Spotify app settings

Create a Spotify app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add the exact value of `SPOTIFY_REDIRECT_URI` to its Redirect URIs. The callback path for this implementation is `/api/spotify/auth/callback`. Spotify requires HTTPS for non-loopback redirect URIs; local development may use an explicit loopback IP such as `http://127.0.0.1:3000/api/spotify/auth/callback` (Spotify does not accept `localhost`).

## Server environment

Set these only in the server environment; do not use `NEXT_PUBLIC_` variables:

- `SPOTIFY_CLIENT_ID`: app client ID.
- `SPOTIFY_CLIENT_SECRET`: app client secret.
- `SPOTIFY_REDIRECT_URI`: exact registered callback URI, including scheme, host, port if present, and path.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY`: a randomly generated 32-byte key encoded as unpadded base64url. Generate one with Node: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Keep it stable and back it up separately from the token file; changing it makes the stored token unreadable.
- `SPOTIFY_TOKEN_STORE_PATH`: absolute path to a durable file writable by the Next.js service account, outside the public web root and source-controlled directories. Back up this encrypted file with the key.

The authorization start and callback routes return `503` if any setting is absent or invalid. The token file contains an AES-256-GCM encrypted refresh token, the granted scope names when available, and a storage timestamp. It is written atomically with owner-only file mode where supported. Access tokens are held only in the server process returned by `refreshSpotifyAccessToken()`; never serialize or log them. Refresh tokens last six months according to Spotify, and refreshing an access token does not extend that lifetime, so the account may need to authorize again.

The start route requests `user-read-playback-state`, `user-modify-playback-state`, `playlist-read-private`, `playlist-read-collaborative`, `user-library-read`, and `user-read-playback-position`, and asks Spotify to show the consent screen. State is random, signed with the encryption key, kept in a short-lived HTTP-only `SameSite=Lax` cookie, and checked on callback. In production the cookie is marked `Secure`; serve the kiosk over HTTPS. The callback returns no token data and redirects to `/settings?spotify=connected` after storing the encrypted refresh token and the granted scope names.

The settings page reads `GET /api/spotify/auth/status` to compare the recorded scope grant with the expected scope list. The response contains only connection state and scope names, never tokens. A legacy token file without recorded scopes is reported as unverified until authorization is completed again. The permission check uses Spotify's authorization grant metadata; it does not infer scope omissions from library endpoint errors.

## Routes and server helper

- `GET /api/spotify/auth/start` begins authorization and redirects to Spotify.
- `GET /api/spotify/auth/callback` validates state, exchanges the code, and durably stores the encrypted refresh token.
- `GET /api/spotify/auth/status` reports whether the stored authorization is unverified, complete, or missing expected scopes.
- `refreshSpotifyAccessToken()` in `app/lib/spotify-auth.ts` refreshes an access token for future server-side Spotify routes. It is server-only and must not be called from client code.

See Spotify's official [Authorization Code flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow), [refresh-token guide](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens), and [redirect URI requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).
