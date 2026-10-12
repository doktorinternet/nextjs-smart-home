# Spotify authorization and permission status

Status: resolved

## Goal

Make Spotify reauthorization request and record the complete expected grant, and expose permission status for the settings UI.

## Scope

- Request the six approved Spotify scopes while preserving the existing playback scopes.
- Present Spotify's consent screen during reauthorization.
- Capture the scope list returned by Spotify and persist it with the server-side authorization record without exposing credentials.
- Redirect successful authorization back to the settings page.
- Expose a no-store permission-status contract that reports unverified, complete, or missing expected scopes without returning tokens.
- Add the agreed mocked-provider lifecycle test for authorization scopes, callback redirect/grant recording, and complete, missing, and unverified status.
- Update Spotify authorization documentation to reflect the current scopes and verification behavior.

## Acceptance Criteria

- The authorization URL requests `user-read-playback-state`, `user-modify-playback-state`, `playlist-read-private`, `playlist-read-collaborative`, `user-library-read`, and `user-read-playback-position`, and requests the consent screen.
- Successful authorization records Spotify's returned scopes and redirects to settings.
- Permission status reports only whether the recorded grant contains each expected scope; a missing scope is named, and a legacy grant without scope metadata is unverified.
- No access token or refresh token is returned to the browser.
- Tests use mocked Spotify responses and assert public lifecycle behavior rather than encrypted-storage internals.

## Comments

Implemented the six-scope consent flow, persisted granted scopes with the encrypted authorization record, settings redirect, and token-free permission-status route. Added a mocked lifecycle test covering unverified, complete, and missing permission states.
