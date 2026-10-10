function sanitizeTutor(tutor) {
if (!tutor) return null;

const safe =
typeof tutor.toObject === "function"
? tutor.toObject()
: JSON.parse(JSON.stringify(tutor));

delete safe.__v;

delete safe.createdAt;
delete safe.updatedAt;

delete safe.earnings;

return safe;
}

module.exports = sanitizeTutor;
