// Everyone we can email for a broadcast:
//   database users + waitlist + scripts/data/paystack_customers.json
//   + scripts/data/extra_emails.json  - scripts/data/exclude_emails.json
// node scripts/admin/allEmailUsers.js   -> prints the count
const { run } = require("../_lib/db");
const { loadJson, loadEmailList } = require("../_lib/data");
const getUsersWithEmails = require("./usersWithEmails");

async function getAllEmailUsers() {
    const dbUsers = await getUsersWithEmails();
    const paystack = loadJson("paystack_customers.json", []).map((u) => ({ name: u.name, email: u.email }));
    const extra = loadEmailList("extra_emails.json").map((email) => ({ name: "BlockHub User", email }));
    const exclude = new Set(loadEmailList("exclude_emails.json"));

    const unique = new Map();
    for (const person of [...dbUsers, ...paystack, ...extra]) {
        const email = String(person.email || "").trim().toLowerCase();
        if (!email || exclude.has(email) || unique.has(email)) continue;
        const name = person.name && person.name !== "No Name" ? person.name : "BlockHub User";
        unique.set(email, { name, email });
    }

    console.log(`📨 Combined unique recipients: ${unique.size} (db ${dbUsers.length}, paystack ${paystack.length}, extra ${extra.length})`);
    return [...unique.values()];
}

if (require.main === module) run(getAllEmailUsers);

module.exports = getAllEmailUsers;
