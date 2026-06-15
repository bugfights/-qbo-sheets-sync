# QBO Sheets Sync

Google Apps Script integration that pulls a Cash Basis Profit & Loss report from QuickBooks Online into Google Sheets.

## Script Properties (stored in Apps Script > Project Settings)

| Property | Value |
|---|---|
| QBO_CLIENT_ID | (Production Client ID from Intuit Developer Portal) |
| QBO_CLIENT_SECRET | (Production Client Secret from Intuit Developer Portal) |
| QBO_REALM_ID | 9341454232012536 |
| WEB_APP_URL | https://script.google.com/macros/s/AKfycbzILqFzo7OmMSxTLQMbqGzxQt-i4NtYvEnxR_wjq6Zj2ZyWLX26eyyI00m57ppaCuMM/exec |

## Token Refresh Process (every ~100 days)

1. Go to https://developer.intuit.com/app/developer/playground
2. Select workspace: J17G - Sheets Cashflow
3. Select app: J17G Sheets Cashflow (Production)
4. Check com.intuit.quickbooks.accounting scope
5. Click Get authorization code and connect Jeff Byrd Bookkeeping
6. Click Get tokens
7. Copy Access token into QBO_ACCESS_TOKEN in Script Properties
8. Copy Refresh token into QBO_REFRESH_TOKEN in Script Properties
9. Set QBO_TOKEN_EXPIRES to 9999999999

## Intuit Developer Portal

- App: J17G Sheets Cashflow
- Workspace: J17G - Sheets Cashflow
- Production Redirect URIs: WEB_APP_URL above + https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl
