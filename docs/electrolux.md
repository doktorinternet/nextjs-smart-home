# Electrolux Pure A9 telemetry

The dashboard reads Pure A9 appliance state through the Electrolux Developer API. The integration is read-only and calls only appliance discovery, appliance state, and token refresh endpoints. It does not send appliance commands.

## Configure local credentials

Create an ignored `.env.local` file at the project root and set:

```dotenv
ELECTROLUX_API_KEY=your-developer-api-key
ELECTROLUX_REFRESH_TOKEN=your-account-refresh-token
ELECTROLUX_TOKEN_ENCRYPTION_KEY=your-32-byte-base64url-key
ELECTROLUX_TOKEN_STORE_PATH=C:\Users\your-name\AppData\Local\smart-home-kiosk\electrolux-token.enc
# Optional when the API account has multiple appliances:
ELECTROLUX_APPLIANCE_ID=your-appliance-id
```

Generate an encryption key locally with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Keep these values in the ignored `.env.local`; do not put them in tracked `.env` files or share them in chat. The server exchanges the refresh token for an access token when needed; the access token stays in server memory and is reused until near expiry. The first successful request encrypts the refresh token to the absolute token-store path. Later refresh-token rotations are persisted there atomically. Once the encrypted store exists, `ELECTROLUX_REFRESH_TOKEN` can be removed from `.env.local`.

Restart the development server after editing `.env.local`. On the dashboard, the Pure A9 panel refreshes every minute and shows supported readings returned by the account. The server response contains selected readings only; credentials and access tokens remain server-side.
