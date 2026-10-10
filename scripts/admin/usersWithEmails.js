// Users + waitlist people who have an email (unique, lowercase).
// node scripts/admin/usersWithEmails.js   -> prints the count
const { run } = require("../_lib/db");
const User = require("../../models/user");
const Waitlist = require("../../models/waitlist");

async function getUsersWithEmails() {
    const [users, waitlist] = await Promise.all([
        User.find({ email: { $nin: [null, ""] } }).select("fullName email").lean(),
        Waitlist.find({ email: { $nin: [null, ""] } }).select("fullName email").lean(),
    ]);

    const unique = new Map();
    for (const person of [...users, ...waitlist]) {
        const email = String(person.email || "").trim().toLowerCase();
        if (email && !unique.has(email)) unique.set(email, { name: person.fullName || "BlockHub User", email });
    }

    console.log(`📧 Users with email: ${users.length} · 📝 Waitlist: ${waitlist.length} · 📨 Unique: ${unique.size}`);
    return [...unique.values()];
}

if (require.main === module) run(getUsersWithEmails);

module.exports = getUsersWithEmails;
