# Settings page and Spotify controls

Status: resolved
Blocked by: 01

## Goal

Give kiosk users a settings destination and a focused Spotify section for permission checks and reauthorization.

## Scope

- Add a gear-style control to the dashboard header that opens the settings page without changing existing dashboard layout behavior.
- Build a general settings page with a left-side icon navigation; Spotify is the only initial section and is selected by default.
- Show Spotify connection and permission status from the permission-status interface.
- Add a permission-check action that reports complete, missing scopes, or unverified status accessibly.
- Add a reauthorization action that starts Spotify's consent flow and returns to settings on success.
- Use the existing dashboard access boundary; do not introduce a PIN or separate login.

## Acceptance Criteria

- A kiosk user can open settings from the dashboard header.
- The settings page initially displays the Spotify section selected in the left-side navigation.
- The user can check granted Spotify permissions and see missing permissions by name.
- The user can reauthorize Spotify and return to settings after successful authorization.
- Existing user changes to dashboard page composition and widget ordering remain intact.
- The UI does not expose OAuth tokens and remains usable at kiosk/mobile viewport sizes.

## Comments

Implemented the dashboard settings link and Spotify-first settings page with permission status, recheck, and reauthorization controls. Verified the page at a narrow viewport with no horizontal overflow.
