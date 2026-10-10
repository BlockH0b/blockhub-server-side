const mongoose = require('mongoose');

const twitterOAuthSchema = new mongoose.Schema({
  state: { type: String, required: true, unique: true },
  codeVerifier: { type: String, required: true },
  role: {
    type: String,
    enum: ['project', 'ambassador', 'user'],
    required: true
  },
  source: String,
  telegramToken: {
    type: String,
    default: null
  },
  createdAt: { type: Date, default: Date.now, index: { expires: 300 } } // expires in 5 min
});

module.exports = mongoose.model('TwitterOAuth', twitterOAuthSchema);
