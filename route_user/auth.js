// SPDX-License-Identifier: MIT
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const payment = require('../models/payment');
const { TwitterApi } = require('twitter-api-v2');
const twitterOAuth = require('../models/twitterOAuth');
const user = require('../models/user');
const auth = require('../middlewave/auth');
const sanitizeUser = require('../utils/sanitizeUser');
const router = express.Router();

const TelegramConnection = require('../models/telegramConnection');

const bot = require("../services/bots/telegramBot");

// Initialize Twitter client (OAuth2 PKCE)
const twitterClient = new TwitterApi({
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
});

const redirectUri = process.env.USER_TWITTER_CALLBACK_URL;

// ✅ Paystack verification helper
async function hasUserPaidPaystack(email) {
  try {
    const transRes = await axios.get(
      `https://api.paystack.co/transaction?status=success`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    return transRes.data.data.some(
      (tx) => tx.customer.email.toLowerCase() === email.toLowerCase()
    );
  } catch (err) {
    console.error(
      'Error checking Paystack payments:',
      err.response?.data || err.message
    );
    return false;
  }
}



// ============================================================
// TELEGRAM CONNECT
// ============================================================
//
// The user MUST already be authenticated.
// auth middleware reads the JWT from the cookie.
// The Telegram token identifies the Telegram account.
// ============================================================

router.post('/telegram/connect', auth, async (req, res) => {

  try {

    // ==========================================
    // Get token sent from frontend
    // ==========================================

    const { token } = req.body;

    if (!token) {

      return res.status(400).json({
        success: false,
        message: 'Telegram connection token is required.',
      });

    }


    // ==========================================
    // Get authenticated BlockHub user
    // ==========================================

    const userId = req.user._id;

    console.log(
      'Telegram connection requested by user:',
      userId.toString()
    );


    // ==========================================
    // Hash incoming token
    // ==========================================

    const crypto = require('crypto');

    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');


    // ==========================================
    // Find Telegram connection
    // ==========================================

    const connection =
      await TelegramConnection.findOne({
        tokenHash,
        used: false,
        expiresAt: {
          $gt: new Date(),
        },
      });


    if (!connection) {

      return res.status(400).json({
        success: false,
        message:
          'Invalid or expired Telegram connection token.',
      });

    }


    // ==========================================
    // Check if this Telegram account is already
    // connected to another BlockHub account
    // ==========================================

    const existingTelegramUser =
      await user.findOne({
        'telegram.id': connection.telegramId,
      });


    if (
      existingTelegramUser &&
      existingTelegramUser._id.toString() !==
      userId.toString()
    ) {

      return res.status(409).json({
        success: false,
        message:
          'This Telegram account is already connected to another BlockHub account.',
      });

    }


    // ==========================================
    // Connect Telegram to current BlockHub user
    // ==========================================

    const updatedUser =
      await user.findByIdAndUpdate(
        userId,
        {
          telegram: {
            id: connection.telegramId,
            username:
              connection.telegramUsername,
            firstName:
              connection.telegramFirstName,
            linkedAt: new Date(),
          },
        },
        {
          new: true,
        }
      );


    if (!updatedUser) {

      return res.status(404).json({
        success: false,
        message: 'BlockHub user not found.',
      });

    }


    // ==========================================
    // SEND SUCCESS MESSAGE TO TELEGRAM
    // =========================================

    try {

      await bot.telegram.sendMessage(
        connection.telegramId,

        `🎉 <b>BlockHub Account Connected!</b>\n\n` +

        `Your Telegram account is now successfully connected to your BlockHub account.\n\n` +

        `You're all set and ready to <b>join, participate, earn points, climb the leaderboard, discover opportunities and earn rewards</b> across the BlockHub ecosystem.\n\n` +

        `🤖 <b>Your Personal Agent is ready.</b>\n\n` +

        `You can now use Agentic BlockBot to interact with the BlockHub ecosystem directly from Telegram.\n\n` +

        `👉 Use <code>/help</code> anytime to see what you can do.\n\n` +

        `Welcome to the ecosystem, BlockHubber. 🚀`,

        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🤖 Open My Agent",
                  callback_data: "agent_home",
                },
              ],
              [
                {
                  text: "❓ How It Works",
                  callback_data: "agent_help",
                },
              ],
            ],
          },
        }
      );

    } catch (telegramError) {

      // Don't fail the account connection
      // just because Telegram notification failed.

      console.error(
        "Telegram success message error:",
        telegramError
      );

    }



    // ==========================================
    // Mark token as used
    // ==========================================

    connection.used = true;

    await connection.save();


    console.log(
      `Telegram ${connection.telegramId} connected to BlockHub user ${userId}`
    );


    // ==========================================
    // SUCCESS
    // ==========================================

    return res.status(200).json({

      success: true,

      message:
        'Telegram account connected successfully.',

      telegram: {
        id: connection.telegramId,
        username:
          connection.telegramUsername,
        firstName:
          connection.telegramFirstName,
      },

      user: sanitizeUser(updatedUser),

    });

  } catch (error) {

    console.error(
      'Telegram connect error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to connect Telegram account.',
    });

  }

});


// ============================================================
// TELEGRAM DISCONNECT
// ============================================================
//
// TESTING ENDPOINT
//
// This requires authentication so random people cannot
// disconnect Telegram accounts.
//
// Later we can remove this or restrict it to admins.
// ============================================================

router.post('/telegram/disconnect', auth, async (req, res) => {

  try {

    const userId = req.user._id;

    const updatedUser =
      await user.findByIdAndUpdate(
        userId,
        {
          $set: {
            'telegram.id': null,
            'telegram.username': null,
            'telegram.firstName': null,
            'telegram.linkedAt': null,
          },
        },
        {
          new: true,
        }
      );


    if (!updatedUser) {

      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });

    }


    console.log(
      `Telegram disconnected from user ${userId}`
    );


    return res.status(200).json({

      success: true,

      message:
        'Telegram account disconnected successfully.',

      user: sanitizeUser(updatedUser),

    });

  } catch (error) {

    console.error(
      'Telegram disconnect error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to disconnect Telegram account.',
    });

  }

});



// ==========================
// Step 1: Redirect to Twitter login
// ==========================
router.get('/auth/twitter', async (req, res) => {
  try {
    const { source, telegramToken } = req.query;
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
      redirectUri,
      {
        scope: [
          'tweet.read',
          'users.read',
          'offline.access',
          'follows.read',
        ],
      }
    );

    await twitterOAuth.create({ state, codeVerifier, role: 'user', source, telegramToken: source === 'telegram' ? telegramToken : null });

    console.log('Redirecting User to Twitter login URL:', url);
    res.redirect(url);
  } catch (err) {
    console.error('Error generating Twitter login URL:', err);
    res.redirect(`${process.env.FRONTEND_URL}`);
  }
});

// ==========================
// Step 2: Handle Twitter callback
// ==========================
router.get('/auth/twitter/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // 1️⃣ Find OAuth record
    const record = await twitterOAuth.findOne({ state, role: 'user' });
    if (!record) return res.redirect(`${process.env.FRONTEND_URL}`);

    const userSource = record.source || 'website';
    const telegramToken = record.telegramToken;
    console.log(userSource);


    // 2️⃣ Exchange code for access token
    const { client: loggedClient } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier: record.codeVerifier,
      redirectUri,
    });

    await twitterOAuth.deleteOne({ state });

    // 3️⃣ Get Twitter user info
    const twitterUser = await loggedClient.v2.me({
      'user.fields': [
        'id',
        'name',
        'username',
        'profile_image_url',
        'verified',
        'public_metrics',
      ],
    });

    const { id, name, username, profile_image_url, verified, public_metrics } = twitterUser.data;

    const twitterData = {
      fullName: name,
      twitterHandle: '@' + username.toLowerCase(),
      twitterId: id,
      profileImage: profile_image_url,
      verified: verified || false,
      followersCount: public_metrics?.followers_count || 0,
      followingCount: public_metrics?.following_count || 0,
      tweetCount: public_metrics?.tweet_count || 0,
    };

    // 4️⃣ Update or create user in DB
    let userDoc = await user.findOneAndUpdate(
      { twitterId: id },
      {
        ...twitterData,
        source: userSource,
      },
      { new: true, upsert: true }
    );

    // 5️⃣ Create JWT
    const token = jwt.sign({ id: userDoc._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // 6️⃣ Serialize full user object for redirect
    const fullUser = {
      ...userDoc.toObject(), // convert mongoose doc to plain object
      token,                // include JWT
    };

    // Base64 encode it to safely pass in URL
    const encodedUser = encodeURIComponent(Buffer.from(JSON.stringify(fullUser)).toString('base64'));

    // 7️⃣ Redirect based on source

    const frontendUrl = process.env.USER_FRONTEND_URL || 'http://localhost:5173';
    let redirectBase = '';

    switch (userSource) {

      case 'academy':
        redirectBase = `${frontendUrl}/academy/waitlist`;
        break;

      case 'website':
        redirectBase = `${frontendUrl}/profile`;
        break;

      case 'marketplace':
        redirectBase = `${frontendUrl}/market`;
        break;

      case 'continueAcademy':
        redirectBase = `${frontendUrl}/dashboard`;
        break;

      case 'newAcademy':
        redirectBase = `${frontendUrl}/academy/courses`;
        break;

      case 'telegram':
        redirectBase = `${frontendUrl}/connect-telegram`;
        break;

      default:
        redirectBase = frontendUrl;
    }

    res.redirect(`${redirectBase}?token=${token}&user=${encodedUser}`);

  } catch (err) {
    console.error('User Twitter callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}`);
  }
});


router.get("/me", auth, (req, res) => {
  res.json({
    success: true,
    user: sanitizeUser(req.user),
  });
});


router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.clearCookie("tutorToken");

  res.json({
    success: true,
    message: "Logged out successfully"
  });
});


// ==========================
// Endpoint: Get all paid users from Paystack
// ==========================
router.get('/paystack/paid-users', async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.paystack.co/transaction',
      {
        params: {
          status: 'success',
          perPage: 100,
          page: 1,
        },
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    );

    const transactions = response.data.data || [];
    const paidUsers = transactions.map((tx) => ({
      email: tx.customer.email,
      name: `${tx.customer.first_name || ''} ${tx.customer.last_name || ''
        }`.trim(),
    }));

    res.json({ count: paidUsers.length, users: paidUsers });
  } catch (err) {
    console.error(
      'Error fetching Paystack payments:',
      err.response?.data || err.message
    );
    res.status(500).json({ error: 'Unable to fetch paid users from Paystack' });
  }
});

router.get("/is_admin", auth, (req, res) => {
  res.json({
    success: true,
    isAdmin: req.user.admin,
  });
});

module.exports = router;
