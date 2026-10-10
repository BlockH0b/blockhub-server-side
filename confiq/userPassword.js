const passport = require("passport");
const User = require("../models/user");
const TwitterStrategy = require("passport-twitter").Strategy;
require('dotenv').config();


passport.use('user-twitter', new TwitterStrategy({
        consumerKey: process.env.TWITTER_CONSUMER_KEY,
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
        callbackURL: process.env.USER_TWITTER_CALLBACK_URL,
    },
    async(token, tokenSecret, profile, done) => {
        console.log('Using strategy: user-twitter'); // in ambassador
        // console.log('Full Twitter Profile:', JSON.stringify(profile, null, 2)); // ✅ full details
        // console.log('Full Twitter Profile:', profile) // ✅ full details


        try {
            let user = await User.findOne({ twitterId: profile.id });

            if (!user) {
                user = await User.create({
                    twitterId: profile.id,
                    twitterHandle: profile.username,
                    fullName: profile.displayName,
                    profileImage: profile.photos[0].value,
                });
            } else {

                user.fullName = user.fullName || profile.displayName;
                user.twitterHandle = user.twitterHandle || profile.username;
                user.profileImage = user.profileImage || profile.photos[0].value;
                await user.save();
            }

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async(id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

module.exports = passport;