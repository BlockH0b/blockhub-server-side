// Create an academy tutor login token for testing.
// node scripts/admin/generateTutorToken.js <tutorId> <userId>
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
const jwt = require("jsonwebtoken");
const { tutorAccessSecret } = require("../../config/secrets");

const [tutorId, userId] = process.argv.slice(2);
if (!tutorId || !userId) {
    console.log("Usage: node scripts/admin/generateTutorToken.js <tutorId> <userId>");
    process.exit(1);
}
if (!tutorAccessSecret()) {
    console.error("❌ JWT_SECRET / TUTOR_ACCESS_SECRET_KEY missing from .env");
    process.exit(1);
}
console.log(jwt.sign({ tutorId, userId }, tutorAccessSecret(), { expiresIn: "24h" }));
