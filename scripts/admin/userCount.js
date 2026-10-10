// node scripts/admin/userCount.js  -> total users in the database
const { run } = require("../_lib/db");
const User = require("../../models/user");

run(async () => {
    const count = await User.countDocuments({});
    console.log(`📊 Total users: ${count}`);
});
