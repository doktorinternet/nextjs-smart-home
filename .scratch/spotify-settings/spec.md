# Spotify Settings and Permission Verification

## Problem Statement

The Spotify library selector can offer playlists, saved podcast episodes, and audiobooks, but the authorization flow does not request every scope required by those features and the app cannot tell which scopes Spotify actually granted. Users have no settings screen where they can reauthorize Spotify or verify that the app has the access it expects.

## Solution

Add a general settings page, initially containing a Spotify section. A gear-style control in the dashboard header opens the page. A left-side icon navigation selects settings sections; Spotify is the only section for this release and is selected by default.

The Spotify section shows whether the granted permissions match the app's expected permissions. It provides a permission-check action and a reauthorization action. Reauthorization sends the user through Spotify's consent screen and returns to the settings page, where the new grant can be checked. The settings page uses the dashboard's existing access boundary; no additional login or PIN is introduced.

## User Stories

1. As a kiosk user, I want a visible settings control on the dashboard, so that I can reach service configuration without changing dashboard layouts.
2. As a kiosk user, I want settings organized into a left-side section navigation, so that service settings can grow without becoming one long page.
3. As a kiosk user, I want Spotify selected by default, so that the initial settings page immediately addresses the current configuration need.
4. As a kiosk user, I want to see whether Spotify is connected, so that I know whether the app has an authorization to inspect.
5. As a kiosk user, I want to check the Spotify permissions granted to the app, so that I can identify an incomplete authorization without interpreting API errors.
6. As a kiosk user, I want any missing permissions named explicitly, so that I know whether reauthorization is needed.
7. As a kiosk user, I want to reauthorize Spotify from settings, so that I can grant scopes added after the original connection.
8. As a kiosk user, I want reauthorization to show Spotify's consent screen and return to settings after success, so that I can review the result in context.
9. As a kiosk user, I want the permission check to recognize playback, playlist, library, and episode-position access, so that it verifies the permissions needed by all current Spotify features.
10. As a kiosk user, I want private and collaborative playlists, saved podcast episodes, and saved audiobooks to remain available to the library selector when Spotify grants the required scopes, so that the selector reflects the content I can access.
11. As a kiosk user, I want the dashboard's existing Spotify playback features to retain their permissions, so that adding library access does not regress playback controls.
12. As a trusted kiosk user, I want settings to use the same access boundary as the dashboard, so that friends with kiosk access can manage the connection without a second login.
13. As a kiosk user, I want missing Spotify configuration or an incomplete grant to be reported clearly, so that I can distinguish setup problems from successful authorization.

## Implementation Decisions

- Add a general settings page with a left-side icon navigation. The Spotify section is the only section in this release and is selected by default.
- Add a gear-style dashboard-header control that navigates to settings. Do not add a settings panel to the selectable dashboard layouts.
- Keep the settings page within the dashboard's current access boundary. Do not add PIN or other authentication.
- Request these Spotify scopes: `user-read-playback-state`, `user-modify-playback-state`, `playlist-read-private`, `playlist-read-collaborative`, `user-library-read`, and `user-read-playback-position`.
- Reauthorization must present Spotify's consent screen. On successful authorization, return to the settings page with a success indication.
- Capture Spotify's granted scope list during authorization and persist it with the existing server-side authorization record. Never expose access tokens or refresh tokens to the client.
- Provide a permission-status interface that compares the recorded grant against the expected scope set and reports complete, missing, or not-yet-verified authorization. A legacy token without a recorded grant is not treated as complete; the user can reauthorize to record the grant.
- The live permission check compares explicit granted-scope metadata; it does not infer missing scopes from playlist or spoken-content API errors.
- Preserve the existing dashboard playback scopes while adding playlist collaboration, saved-library, and saved-episode-position scopes.

## Testing Decisions

- Tests assert user-observable authorization and permission-status behavior through the agreed Spotify authorization lifecycle boundary, with Spotify's token endpoint mocked. They do not inspect encrypted storage layout or other implementation details.
- Cover the authorization request's expected scopes and consent prompt, callback persistence of the granted scopes and redirect to settings, and permission status for complete, incomplete, and unverified grants.
- Use the existing Node-based mocked-provider auth test as prior art. Keep the lifecycle contract in one focused Spotify auth test rather than adding a browser-test framework solely for this feature.

## Out of Scope

- PIN authentication or a separate settings login.
- Editing arbitrary application configuration values in this release.
- Settings sections for services other than Spotify.
- A live Spotify API smoke test; permission verification uses the explicit granted-scope list.
- Changes to playlist, podcast, or audiobook playback behavior beyond the required authorization scopes.

## Further Notes

The previous authorization record contains no granted-scope metadata, so its permission status is unverified until Spotify authorization is completed again. Spotify's current saved-episode endpoint requires `user-read-playback-position`; collaborative playlists require `playlist-read-collaborative`.
