function sanitizeUser(user) {
if (!user) return null;

const safe =
typeof user.toObject === "function"
? user.toObject()
: JSON.parse(JSON.stringify(user));

delete safe.twitterId;

delete safe.tutorProfile;
// delete safe.isTutor;
// delete safe._id;
;

// Internal flags
delete safe.admin;
delete safe.emailSent;

// Mongoose internals
delete safe.__v;

// Optional timestamps
delete safe.createdAt;
delete safe.updatedAt;

return safe;
}

module.exports = sanitizeUser;
