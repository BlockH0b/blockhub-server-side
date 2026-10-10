const mongoose = require('mongoose')

const ambassadorSchema = new mongoose.Schema({
  twitterId: { type: String, required: true },
  name: String,
  username: String,
  twitter_handle: String,

  accessToken: String,
  refreshToken: String,
  is_Campaign: {type : Boolean , default: false},
  tokenExpiry: { type: Date },   // <-- store as Date instead of String

  img: String,
  ip: String,

  project: { type: Boolean, default: false },
  totalGlobalPoints: { type: Number, default: 0 },
  totalGlobalTasks: { type: Number, default: 0 },
  

  lastCheckedAt: { type: Date, default: null }, // <-- for cron queue
  joinedAt: { type: Date, default: Date.now }
}, { collection: 'ambassadors' })

module.exports = mongoose.models.Ambassador || mongoose.model('Ambassador', ambassadorSchema);
