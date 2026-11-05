const jwt = require("jsonwebtoken");
const User = require("../models/user");
const CohortTutor = require("../models/CohortTutor");
const CohortRegistration = require("../models/Cohort");
const { COHORT_COOKIE_NAME } = require("./cohortAuth");
const { readMeetingAccessToken, meetingCookieName } = require("../services/meetings/tokens");

// Lazy (avoids a require cycle with services/liveClass.helpers)
const getMeetingModel = () => require("../models/Meeting");

/*
 * liveClassAuth
 * ------------------------------------------------------------
 * Works out WHO is calling a live-class endpoint and attaches:
 *
 *   req.viewer = {
 *     userId, name, avatar,
 *     role: "host" | "student",
 *     kind: "tutor" | "admin" | "student" | "member" | "guest",
 *     isAdmin,                // true for BlockHub admins (they host Meetings)
 *     cohort, track           // null for admins / members / guests
 *     meetingId               // guests only: the meeting they RSVP'd to
 *   }
 *
 * Accepted sessions (first match wins):
 *   1. Main BlockHub login ("token" cookie)
 *        - cohort tutor  -> host for their track
 *        - admin         -> host for any track (and all Meetings)
 *        - registered cohort student -> student
 *   2. Cohort dashboard cookie ("BHCtoken") -> student
 *   3. Main login, no cohort role -> "member" (can join Meetings only)
 *   4. Meeting RSVP cookie (bhm_<code>) or x-meeting-token header
 *        -> "guest" for that one Meeting only
 */

function safeVerify(token) {
    if (!token || typeof token !== "string") return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

function buildStudent(user, registration) {
    return {
        userId: String(user._id),
        name: user.fullName || registration.fullName || "Student",
        avatar: user.profileImage || null,
        role: "student",
        kind: "student",
        isAdmin: false,
        email: user.email || registration.email || null,
        cohort: registration.cohort,
        track: registration.track,
    };
}

/**
 * Track / cohort names are compared loosely, so "Full Stack Web Development",
 * "Full-Stack Web Development" and "full stack web development " all match,
 * and so do "cohort-1.0" and "Cohort 1.0".
 */
function keyOf(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sameKey(a, b) {
    const ka = keyOf(a);
    return Boolean(ka) && ka === keyOf(b);
}

/** Same rules as the routes use: can this identity host / see this class? */
function fitsSession(viewer, session) {
    if (viewer.kind === "admin") return true;
    return sameKey(viewer.cohort, session.cohort) && sameKey(viewer.track, session.track);
}

/**
 * Every identity the browser can prove, best first:
 *   main login as tutor / admin, main login as a registered student,
 *   then the cohort dashboard cookie (BHCtoken) as a student.
 * Also returns the main user (for the "member" fallback).
 */
async function collectIdentities(req) {
    const identities = [];
    let mainUser = null;

    /* ---------- 1. Main login cookie ---------- */
    const mainDecoded = safeVerify(req.cookies?.token);
    const mainUserId = mainDecoded?.id || mainDecoded?.userId || mainDecoded?._id;

    if (mainUserId) {
        mainUser = await User.findById(mainUserId)
            .select("_id fullName email profileImage admin isCohortTutor cohortTutorProfile")
            .lean();
        const user = mainUser;

        if (user) {
            if (user.isCohortTutor) {
                const tutor =
                    (user.cohortTutorProfile &&
                        (await CohortTutor.findById(user.cohortTutorProfile).lean())) ||
                    (await CohortTutor.findOne({ user: user._id }).lean());

                if (tutor && tutor.status === "active") {
                    identities.push({
                        userId: String(user._id),
                        name: user.fullName || "Tutor",
                        avatar: user.profileImage || null,
                        role: "host",
                        kind: "tutor",
                        isAdmin: Boolean(user.admin),
                        email: user.email || null,
                        cohort: tutor.cohort,
                        track: tutor.track,
                        via: "main-login",
                    });
                }
            }

            if (user.admin) {
                identities.push({
                    userId: String(user._id),
                    name: user.fullName || "BlockHub Admin",
                    avatar: user.profileImage || null,
                    role: "host",
                    kind: "admin",
                    isAdmin: true,
                    email: user.email || null,
                    cohort: null,
                    track: null,
                    via: "main-login",
                });
            }

            const registration = await CohortRegistration.findOne({
                user: user._id,
                status: { $ne: "rejected" },
            })
                .sort({ createdAt: -1 })
                .lean();

            if (registration) {
                identities.push({ ...buildStudent(user, registration), via: "main-login" });
            }
        }
    }

    /* ---------- 2. Cohort dashboard cookie ---------- */
    const cohortDecoded = safeVerify(req.cookies?.[COHORT_COOKIE_NAME]);

    if (
        cohortDecoded?.purpose === "cohort_dashboard" &&
        cohortDecoded.userId &&
        cohortDecoded.registrationId
    ) {
        const registration = await CohortRegistration.findOne({
            _id: cohortDecoded.registrationId,
            user: cohortDecoded.userId,
        }).lean();

        if (registration && registration.status !== "rejected") {
            const user = await User.findById(cohortDecoded.userId)
                .select("_id fullName profileImage")
                .lean();

            if (user) identities.push({ ...buildStudent(user, registration), via: "cohort-login" });
        }
    }

    return { identities, mainUser };
}

/** The cohort class this request is about (null for meetings / no code) */
async function sessionForRequest(req) {
    const code = codeFromPath(req);
    if (!code) return null;
    // eslint-disable-next-line global-require
    const LiveSession = require("../models/LiveSession");
    const session = await LiveSession.findOne({ code }).select("kind cohort track").lean();
    if (!session || session.kind === "meeting") return null;
    return session;
}

async function resolveViewer(req) {
    const { identities, mainUser } = await collectIdentities(req);

    if (identities.length) {
        // Opening a particular class: use the login that fits THAT class.
        // (e.g. a student whose main BlockHub login is a different account
        //  than their cohort login, or a tutor who is also a student)
        const session = await sessionForRequest(req);
        if (session) {
            const host = identities.find((v) => v.role === "host" && fitsSession(v, session));
            if (host) return host;
            const fits = identities.find((v) => fitsSession(v, session));
            if (fits) return fits;
        }
        return identities[0];
    }

    /* ---------- 3. Signed-in BlockHub member (Meetings only) ---------- */
    if (mainUser) {
        return {
            userId: String(mainUser._id),
            name: mainUser.fullName || "BlockHub member",
            avatar: mainUser.profileImage || null,
            role: "student",
            kind: "member",
            isAdmin: false,
            email: mainUser.email || null,
            cohort: null,
            track: null,
            via: "main-login",
        };
    }

    /* ---------- 4. Meeting guest (RSVP'd with name + email) ---------- */
    return resolveMeetingGuest(req);
}

/** The meeting code in /sessions/:code/... (or null) */
function codeFromPath(req) {
    const match = String(req.path || "").match(/^\/sessions\/([^/]+)/);
    if (!match || match[1] === "active") return null;
    // eslint-disable-next-line global-require
    const { normaliseCode } = require("../services/liveClass.helpers");
    try {
        return normaliseCode(decodeURIComponent(match[1]));
    } catch {
        return null;
    }
}

async function resolveMeetingGuest(req) {
    const code = codeFromPath(req);
    if (!code) return null;

    const token = req.cookies?.[meetingCookieName(code)] || req.get("x-meeting-token");
    const decoded = readMeetingAccessToken(token);
    if (!decoded || decoded.code !== code) return null;

    const meeting = await getMeetingModel()
        .findOne({ _id: decoded.meetingId, code })
        .select("_id rsvps")
        .lean();
    if (!meeting) return null;

    const rsvp = (meeting.rsvps || []).find(
        (r) => String(r._id) === decoded.rsvpId && r.status === "going"
    );
    if (!rsvp) return null;

    return {
        userId: String(rsvp._id),
        name: rsvp.name || "Guest",
        avatar: null,
        role: "student",
        kind: "guest",
        isAdmin: false,
        email: rsvp.email,
        meetingId: String(meeting._id),
        cohort: null,
        track: null,
    };
}

const liveClassAuth = async (req, res, next) => {
    try {
        const viewer = await resolveViewer(req);

        if (!viewer) {
            // Opening a Meeting link without RSVP -> send them to the meeting page
            const code = codeFromPath(req);
            if (code && (await getMeetingModel().exists({ code }))) {
                return res.status(401).json({
                    success: false,
                    code: "MEETING_RSVP_REQUIRED",
                    meetingCode: code,
                    message: "Tell us your name and email to join this meeting.",
                });
            }

            return res.status(401).json({
                success: false,
                code: "AUTH_REQUIRED",
                message: "Please sign in to your BlockHub cohort account to join this class.",
            });
        }

        req.viewer = viewer;
        next();
    } catch (error) {
        console.error("liveClassAuth error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to verify your account right now.",
        });
    }
};

const requireHost = (req, res, next) => {
    if (req.viewer?.role !== "host") {
        return res.status(403).json({
            success: false,
            message: "Only the class tutor can do this.",
        });
    }
    next();
};

module.exports = { liveClassAuth, requireHost, resolveViewer, sameKey };
