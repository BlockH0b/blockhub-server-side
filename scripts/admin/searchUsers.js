// node scripts/admin/searchUsers.js <text>
// Finds users where ANY text field contains <text> (case-insensitive)
const { run } = require("../_lib/db");
const User = require("../../models/user");

const term = process.argv[2];
if (!term) {
    console.log("Usage: node scripts/admin/searchUsers.js <text>");
    process.exit(1);
}

run(async () => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    const fields = Object.keys(User.schema.paths).filter((f) => User.schema.paths[f].instance === "String");
    const users = await User.find({ $or: fields.map((f) => ({ [f]: regex })) })
        .select("fullName twitterHandle email")
        .lean();

    console.log(`Found ${users.length} user(s) matching "${term}":`);
    users.forEach((u) => console.log(`- ${u.fullName || "(no name)"}  ${u.twitterHandle || ""}  ${u.email || ""}`));
});
