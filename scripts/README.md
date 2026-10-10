# Backend scripts (run by hand)

All scripts read secrets from `Backend/.env`. **Nothing secret is written in code.**
Private data (personal emails, customer lists) lives in `scripts/data/`, which is
git-ignored. See `scripts/data.example/` for the file formats.

Run from the `Backend` folder:

| Command | What it does |
|---|---|
| `node scripts/admin/userCount.js` | Total users |
| `node scripts/admin/searchUsers.js <text>` | Find users by any text field |
| `node scripts/admin/deleteUser.js @handle` | Preview, then add `--yes` to delete |
| `node scripts/admin/usersWithEmails.js` | Users + waitlist with an email |
| `node scripts/admin/allEmailUsers.js` | Everyone for a broadcast (db + waitlist + private lists) |
| `node scripts/admin/last500UserEmails.js` | Newest 500 users not emailed yet |
| `node scripts/admin/exportPaystackCustomers.js` | Saves Paystack customers to `scripts/data/` |
| `node scripts/admin/sendBroadcast.js --html scripts/broadcasts/cohort-registration.html --subject "..."` | Preview a broadcast; add `--send` to send |
| `node scripts/admin/generateTutorToken.js <tutorId> <userId>` | Test token for an academy tutor |
| `node scripts/fixTrackNames.js` | Preview track renames; `--apply` to save |
| `node scripts/sendCohortDashboardAccessEmails.js` | Cohort dashboard links (existing) |
| `node scripts/sendReferralGroupEmails.js` | Referral emails (existing) |
| `node scripts/sendCreatorsEmail.js` | Creator circle emails (existing) |

All email scripts follow `EMAIL_TEST_MODE` and `EMAIL_TEST_RECIPIENTS` in `.env`.
