const mongoose = require("mongoose");

/*
 * CohortTicket - a student's question to their track tutor.
 * Works like an email thread: every new message is emailed to the
 * other side with a button that opens the ticket on the dashboard.
 */
const messageSchema = new mongoose.Schema(
    {
        from: { type: String, enum: ["student", "tutor", "admin"], required: true },
        authorName: { type: String, trim: true },
        body: { type: String, required: true, trim: true, maxlength: 5000 },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

const cohortTicketSchema = new mongoose.Schema(
    {
        cohort: { type: String, required: true, index: true },
        track: { type: String, required: true, index: true },

        student: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
        studentName: { type: String, trim: true },
        studentEmail: { type: String, trim: true, lowercase: true },

        subject: { type: String, required: true, trim: true, maxlength: 160 },
        category: {
            type: String,
            enum: ["class", "assignment", "technical", "other"],
            default: "class",
        },
        status: { type: String, enum: ["open", "answered", "closed"], default: "open", index: true },

        messages: { type: [messageSchema], default: [] },
        lastMessageAt: { type: Date, default: Date.now },
        lastMessageFrom: { type: String, default: "student" },
    },
    { timestamps: true, collection: "cohorttickets" }
);

cohortTicketSchema.index({ cohort: 1, track: 1, lastMessageAt: -1 });

module.exports = mongoose.models.CohortTicket || mongoose.model("CohortTicket", cohortTicketSchema);
