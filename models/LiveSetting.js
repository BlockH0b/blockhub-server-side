const mongoose = require("mongoose");

/*
 * LiveSetting
 * ------------------------------------------------------------
 * Tiny key/value store for BlockHub Live admin settings.
 *   key "liveProvider" -> { defaultProvider: "livekit" | "youtube" }
 *   key "youtube"      -> { refreshToken, channelId, channelTitle, connectedAt }
 */
const liveSettingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, index: true },
        value: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, collection: "livesettings" }
);

module.exports =
    mongoose.models.LiveSetting ||
    mongoose.model("LiveSetting", liveSettingSchema);
