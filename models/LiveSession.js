const mongoose = require("mongoose");

/*
 * LiveSession
 * ------------------------------------------------------------
 * One BlockHub Live video class. It can belong to a scheduled
 * CohortClass, or be an "instant" class the tutor starts any time.
 *
 * Students join with the code (e.g. "kqm-tzwa-pxd") or the link
 * /class/<code>. Only students in the same cohort + track can join.
 *
 * kind: "meeting" -> a general BlockHub Meeting (see models/Meeting.js).
 * Those have no cohort/track; anyone with the link who RSVPs can join
 * and only admins can host.
 */

const lobbyEntrySchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        name: { type: String, trim: true, default: "Student" },
        avatar: { type: String, default: null },
        status: {
            type: String,
            enum: ["waiting", "admitted", "denied"],
            default: "waiting",
        },
        requestedAt: { type: Date, default: Date.now },
        decidedAt: { type: Date, default: null },
    },
    { _id: false }
);

const liveSessionSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, index: true },
        roomName: { type: String, required: true, unique: true },

        title: { type: String, required: true, trim: true },

        kind: { type: String, enum: ["class", "meeting"], default: "class", index: true },
        meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting", default: null },

        // Required for cohort classes only (meetings have no track)
        cohort: {
            type: String,
            required: function cohortRequired() { return this.kind !== "meeting"; },
            default: "cohort-1.0",
            index: true,
        },
        track: {
            type: String,
            required: function trackRequired() { return this.kind !== "meeting"; },
            trim: true,
            index: true,
        },

        // Optional link to the scheduled class this call is for
        cohortClass: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CohortClass",
            default: null,
            index: true,
        },

        host: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },

        status: {
            type: String,
            enum: ["scheduled", "live", "ended"],
            default: "scheduled",
            index: true,
        },

        settings: {
            // Students wait until the tutor admits them
            waitingRoom: { type: Boolean, default: false },
            // Students can share their screen without asking
            allowStudentScreenShare: { type: Boolean, default: false },
            // Students join with their microphone off
            muteStudentsOnJoin: { type: Boolean, default: true },
        },

        lobby: { type: [lobbyEntrySchema], default: [] },

        // Users the tutor removed - they cannot rejoin this session
        blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],

        // Students the tutor allowed to share their screen
        screenShareAllowed: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],

        startedAt: { type: Date, default: null },
        endedAt: { type: Date, default: null },

        peakParticipants: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        collection: "livesessions",
    }
);

liveSessionSchema.index({ cohort: 1, track: 1, status: 1 });

module.exports =
    mongoose.models.LiveSession ||
    mongoose.model("LiveSession", liveSessionSchema);
