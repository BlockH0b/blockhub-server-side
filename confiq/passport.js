const passport = require("passport");
const TwitterStrategy = require("passport-twitter").Strategy;
const User = require("../models/user");
const jwt = require("jsonwebtoken");

passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: process.env.TWITTER_CALLBACK_URL,
      includeEmail: true,
    },
    async (token, tokenSecret, profile, done) => {
      console.log("Raw Twitter profile:", profile);

      try {
        const { id, displayName, username, photos, emails, _json } = profile;

        const twitterData = {
          fullName: displayName,
          twitterHandle: "@" + username.toLowerCase(),
          twitterId: id,
          profileImage: photos?.[0]?.value,
          verified: _json?.verified || false,
          followersCount: _json?.followers_count || 0,
          followingCount: _json?.friends_count || 0,
          tweetCount: _json?.statuses_count || 0,
          bio: _json?.description?.trim() || null
        };

        // Only include email if it exists
        const email = emails?.[0]?.value;

        // 🔥 Single clean DB operation (update or create)
        let user = await User.findOneAndUpdate(
          { twitterId: id },
          {
            $set: {
              ...twitterData,
              ...(email && { email }), // only set email if available
            },
          },
          {
            new: true,     // return updated doc
            upsert: true,  // create if not exists
          }
        );

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Session handling
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;