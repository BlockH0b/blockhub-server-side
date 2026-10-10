require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { TwitterApi } = require('twitter-api-v2');
const Ambassador = require('../models/Ambassadors');
const LegacyAmbassador = require('../models/LegacyAmbassador');

const twitterOAuth = require('../models/twitterOAuth'); // same model you used for user
const router = express.Router();

// Initialize Twitter client (OAuth2 PKCE)
const twitterClient = new TwitterApi({
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
});

const redirectUri = process.env.TWITTER_CALLBACK_URL;

// Step 1: Redirect to Twitter login
router.get('/twitter', async (req, res) => {
  try {
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
      redirectUri,
      { scope: ['tweet.read', 'users.read', 'offline.access', 'follows.read'] }
    );

    // save verifier + state for callback
    await twitterOAuth.create({ state, codeVerifier, role: 'ambassador' });

    console.log('Redirecting Ambassador to Twitter login URL:', url);
    res.redirect(url);
  } catch (err) {
    console.error('Error generating Ambassador Twitter login URL:', err);
    res.redirect(`${process.env.FRONTEND_URL}/error`);
  }
});


router.get('/twitter/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const record = await twitterOAuth.findOne({ state });
    if (!record) return res.redirect(`${process.env.FRONTEND_URL}/login`);

    const { client: loggedClient, accessToken, refreshToken, expiresIn } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier: record.codeVerifier,
      redirectUri
    });

    await twitterOAuth.deleteOne({ state });

    const twitterUser = await loggedClient.v2.me({
      'user.fields': ['id', 'name', 'username', 'profile_image_url', 'verified', 'public_metrics']
    });

    const twitterId = twitterUser.data.id;
    const twitterHandle = '@' + twitterUser.data.username;
    const twitterName = twitterUser.data.name;
    const twitterImage = twitterUser.data.profile_image_url;
    const followersCount = twitterUser.data.public_metrics.followers_count || 0;

    // Check only the new Ambassador collection
    let ambassador = await Ambassador.findOne({ twitterId });
    if (!ambassador) {
      // Create new ambassador
      ambassador = new Ambassador({
        twitterId,
        name: twitterName,
        twitter_handle: twitterHandle,
        img: twitterImage,
        followers: followersCount,
        totalGlobalPoints: 0,
        totalGlobalTasks: 0,
        project: false,
        accessToken,
        refreshToken,
        is_Campaign: true,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000)
      });
      await ambassador.save();
    } else {
      // Update existing ambassador info + tokens
      ambassador.name = twitterName;
      ambassador.twitter_handle = twitterHandle;
      ambassador.img = twitterImage;
      ambassador.followers = followersCount;

      ambassador.accessToken = accessToken;
      ambassador.refreshToken = refreshToken;
      ambassador.tokenExpiry = new Date(Date.now() + expiresIn * 1000);

      ambassador.is_Campaign = true;

      await ambassador.save();
    }


    // Issue JWT
    const token = jwt.sign(
      { id: ambassador._id, role: 'ambassador' },
      process.env.JWT_SECRET
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/grindfi?token=${token}&id=${ambassador._id}&username=${encodeURIComponent(twitterName)}&handle=${twitterHandle}&img=${encodeURIComponent(twitterImage)}&followers=${followersCount}`
    );

  } catch (err) {
    console.error('Ambassador Twitter callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/error`);
  }
});



// leaderboard + ambassador fetch
router.post('/get-ambassador', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Please authenticate' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const ambassador = await Ambassador.findById(decoded.id);
    if (!ambassador) return res.status(404).json({ message: 'Ambassador not found' });

    const leaderboard = await Ambassador.find().sort({ total_points: -1 });
    res.status(200).json({ ambassador, leaderboard });
  } catch (err) {
    console.error('Error getting ambassador:', err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
