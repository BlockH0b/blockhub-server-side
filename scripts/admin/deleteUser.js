// node scripts/admin/deleteUser.js @twitterHandle          -> preview
// node scripts/admin/deleteUser.js @twitterHandle --yes    -> delete
const { run } = require("../_lib/db");
const User = require("../../models/user");

const handle = process.argv[2];
const confirmed = process.argv.includes("--yes");

if (!handle) {
    console.log("Usage: node scripts/admin/deleteUser.js @handle [--yes]");
    process.exit(1);
}

run(async () => {
    const user = await User.findOne({ twitterHandle: handle }).select("_id fullName email twitterHandle").lean();
    if (!user) {
        console.log(`No user with twitterHandle "${handle}".`);
        return;
    }
    console.log("Found:", user);
    if (!confirmed) {
        console.log("\nNothing deleted. Run again with --yes to delete this user.");
        return;
    }
    await User.deleteOne({ _id: user._id });
    console.log(`🗑  Deleted ${handle}`);
});
