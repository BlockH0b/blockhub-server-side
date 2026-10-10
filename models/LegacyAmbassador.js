const mongoose = require('mongoose')

const ambassadorSchema = new mongoose.Schema({
    twitterId: String,
    name: String,
    username: String,
    twitter_handle: String,
    img: String,
    points: Number,
    tweets: [String],
    total_tweets: Number,
    total_points: Number,
    ip: String,
    joinedAt: { type: Date, default: Date.now }
}, { collection: 'ambassador' })

module.exports = mongoose.model.LegacyAmbassador || mongoose.model('LegacyAmbassador', ambassadorSchema)

