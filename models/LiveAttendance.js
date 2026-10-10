const mongoose = require("mongoose");

/*
 * LiveAttendance
 * ------------------------------------------------------------
 * One row per (session, person). Filled automatically from
 * LiveKit webhooks (participant_joined / participant_left), with a
 * fallback "joined" mark when a join token is issued.
 */

const visitSchema = new mongoose.Schema(
    {
        joinedAt: { type: Date, required: true },
        leftAt: { type: Date, default: null },
    },
    { _id: false }
);

const liveAttendanceSchema = new mongoose.Schema(
    {
        session: { type: mongoose.Schema.Types.ObjectId, ref: "LiveSession", required: true, index: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },

        role: { type: String, enum: ["host", "student"], default: "student" },
        name: { type: String, trim: true, default: "" },

        visits: { type: [visitSchema], default: [] },

        firstJoinedAt: { type: Date, default: null },
        lastLeftAt: { type: Date, default: null },

        // Total time in the call (seconds), summed across visits
        totalSeconds: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        collection: "liveattendance",
    }
);

liveAttendanceSchema.index({ session: 1, user: 1 }, { unique: true });

module.exports =
    mongoose.models.LiveAttendance ||
    mongoose.model("LiveAttendance", liveAttendanceSchema);
