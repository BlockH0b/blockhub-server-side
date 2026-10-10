// Newest 500 users who haven't been emailed yet (User.emailSent != true)
// node scripts/admin/last500UserEmails.js
const { run } = require("../_lib/db");
const User = require("../../models/user");

async function getLast500UsersEmail() {
    const users = await User.find({ emailSent: { $ne: true }, email: { $nin: [null, ""] } })
        .sort({ createdAt: -1 })
        .limit(500)
        .select("email fullName")
        .lean();
    const list = users.map((u) => ({ email: u.email, name: u.fullName }));
    console.log(`✅ ${list.length} users not emailed yet`);
    return list;
}

if (require.main === module) run(getLast500UsersEmail);

module.exports = getLast500UsersEmail;
