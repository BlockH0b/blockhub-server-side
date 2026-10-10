# scripts/data (private)

Copy this folder to `scripts/data/` and fill it in. `scripts/data/` is
**git-ignored**, so personal emails and customer lists never reach GitHub.

| File | Used by | Format |
|---|---|---|
| `extra_emails.json` | `admin/allEmailUsers.js`, `admin/sendBroadcast.js` | `["a@x.com", "b@y.com"]` |
| `exclude_emails.json` | same | `["skip@x.com"]` |
| `paystack_customers.json` | same (create with `admin/exportPaystackCustomers.js`) | `[{ "email": "...", "name": "..." }]` |
| `creators_emails.json` | `sendCreatorsEmail.js` | `["a@x.com"]` |
