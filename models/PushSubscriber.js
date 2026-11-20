const mongoose = require("mongoose");

/*
 * PushSubscriber
 * ------------------------------------------------------------
 * One row per user: have they turned on push notifications in
 * the BlockHub app? The app reports this (POST /push/subscription)
 * and the push service uses it to decide push vs email.
 *
 * The OneSignal "external_id" of a device is the user's _id, so
 * we only need to know WHO is subscribed, not their device ids.
 */

const pushSubscriberSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, unique: true },
        subscribed: { type: Boolean, default: false, index: true },
        subscriptionId: { type: String, default: null }, // OneSignal subscription id (for debugging)
        platform: { type: String, enum: ["ios", "android", "desktop", "other"], default: "other" },
        standalone: { type: Boolean, default: false }, // opened as the installed app
        lastSeenAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.models.PushSubscriber || mongoose.model("PushSubscriber", pushSubscriberSchema);
