const mongoose = require("mongoose");

/*
 * Meeting  (BlockHub Meetings)
 * ------------------------------------------------------------
 * A general BlockHub video call that ADMINS schedule - community
 * calls, AMAs, partner calls, team calls. Not tied to a cohort track.
 *
 *   share link   https://blockhubglobal.xyz/meet/<code>
 *   people RSVP  (name + email, or their BlockHub account)
 *              -> confirmation email with a calendar invite
 *   at the time  the host starts it and everyone joins the call
 *
 * The video call itself is a LiveSession (kind: "meeting") with the
 * same code, so it uses the exact same BlockHub Live room.
 */

const rsvpSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, required: true, maxlength: 80 },
        email: { type: String, trim: true, lowercase: true, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },

        status: { type: String, enum: ["going", "declined"], default: "going" },
        source: { type: String, enum: ["link", "invite", "account"], default: "link" },

        respondedAt: { type: Date, default: Date.now },
        firstJoinedAt: { type: Date, default: null },
    },
    { timestamps: false }
);

const inviteSchema = new mongoose.Schema(
    {
        email: { type: String, trim: true, lowercase: true, required: true },
        name: { type: String, trim: true, default: "" },
        invitedAt: { type: Date, default: Date.now },
        invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    },
    { _id: false }
);

const meetingSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, index: true },

        title: { type: String, required: true, trim: true, maxlength: 140 },
        description: { type: String, trim: true, default: "", maxlength: 4000 },

        startsAt: { type: Date, required: true, index: true },
        durationMinutes: { type: Number, default: 60, min: 5, max: 600 },

        // Who runs the call (any admin can manage it)
        host: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        hostName: { type: String, trim: true, default: "BlockHub" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

        status: {
            type: String,
            enum: ["scheduled", "live", "ended", "cancelled"],
            default: "scheduled",
            index: true,
        },

        liveSession: { type: mongoose.Schema.Types.ObjectId, ref: "LiveSession", default: null },

        settings: {
            // People wait until the host lets them in
            waitingRoom: { type: Boolean, default: true },
            // Anyone can share their screen without asking
            allowScreenShare: { type: Boolean, default: false },
            // People join with their mic off
            muteOnJoin: { type: Boolean, default: true },
            // Email everyone who RSVP'd when the host starts the call
            notifyOnStart: { type: Boolean, default: true },
        },

        rsvps: { type: [rsvpSchema], default: [] },
        invites: { type: [inviteSchema], default: [] },

        // Calendar invite version - goes up when time/title changes,
        // so calendars update the existing event instead of adding a new one
        sequence: { type: Number, default: 0 },

        cancelledAt: { type: Date, default: null },
        cancelReason: { type: String, trim: true, default: "" },
    },
    {
        timestamps: true,
        collection: "meetings",
    }
);

meetingSchema.index({ "rsvps.email": 1 });
meetingSchema.index({ "rsvps.user": 1 });
meetingSchema.index({ "invites.email": 1 });

meetingSchema.virtual("endsAt").get(function endsAt() {
    return new Date(new Date(this.startsAt).getTime() + (this.durationMinutes || 60) * 60000);
});

module.exports = mongoose.models.Meeting || mongoose.model("Meeting", meetingSchema);
