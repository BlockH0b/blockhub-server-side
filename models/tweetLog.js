const mongoose = require('mongoose');

const tweetLogSchema = new mongoose.Schema({
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador' },
  tweetId: String,
  projectId: String,
  hashtag: String,
  pointsAwarded: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TweetLog', tweetLogSchema);
