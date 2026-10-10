const cron = require("node-cron");
const Ambassador = require("../models/Ambassadors");
const Task = require('../models/task');
const { TwitterApi } = require('twitter-api-v2');
const TweetLog = require('../models/tweetLog');
const projectAmbassador = require("../models/projectAmbassador");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// App-level client for token refresh
const twitterClient = new TwitterApi({
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
});

// === QUEUE STATE ===
let ambassadorQueue = [];
let currentIndex = 0;

// Refresh queue from DB (initial + hourly refresh)
async function refreshAmbassadorQueue() {
  ambassadorQueue = await Ambassador.find({ is_Campaign: true }).lean();
  currentIndex = 0;
  console.log(`🔄 Ambassador queue refreshed. Count: ${ambassadorQueue.length}`);
}

// Fetch tweets (with better error logging)
async function fetchRecentTweets(client, twitterId) {
  console.log(`📡 Fetching tweets for twitterId=${twitterId}`);
  try {
    const response = await client.v2.userTimeline(twitterId, {
      max_results: 15,
      "tweet.fields": "id,text,created_at",
    });
    console.log(`✅ Tweets fetched for ${twitterId}. Count: ${response.data?.data?.length || 0}`);
    return response.data?.data || [];
  } catch (err) {
    console.error("❌ Error fetching tweets:", {
      message: err.message,
      code: err.code,
      status: err?.status,
      data: err.data || err.response?.data,
      stack: err.stack
    });
    return [];
  }
}

// Process ambassador
async function processAmbassador(amb) {
  console.log(`\n👤 Processing ambassador: ${amb.twitter_handle}`);

  if (!amb.accessToken) {
    console.log(`⚠️ Skipping ${amb.twitter_handle}, missing accessToken`);
    return;
  }

  console.log(`🔑 Using accessToken: ${amb.accessToken.slice(0, 8)}...`);
  let client = new TwitterApi(amb.accessToken);

  if (!amb.twitterId && amb.twitter_handle) {
    console.log(`🔍 No twitterId saved for ${amb.twitter_handle}, fetching...`);
    try {
      const user = await client.v2.userByUsername(amb.twitter_handle.replace("@", ""));
      amb.twitterId = user.data.id;
      await amb.save();
      console.log(`🔧 Added numeric ID for ${amb.twitter_handle} => ${amb.twitterId}`);
    } catch (err) {
      console.log(`❌ Failed to fetch ID for ${amb.twitter_handle}:`, {
        message: err.message,
        status: err?.status,
        data: err.data || err.response?.data
      });
      return;
    }
  }

  // Token refresh
  if (amb.tokenExpiry && new Date() >= amb.tokenExpiry && amb.refreshToken) {
    console.log(`⏳ Token expired for ${amb.twitter_handle}, refreshing...`);
    try {
      const {
        client: refreshedClient,
        accessToken,
        refreshToken,
        expiresIn,
      } = await twitterClient.refreshOAuth2Token(amb.refreshToken);

      console.log(`🔑 New accessToken: ${accessToken.slice(0, 8)}...`);
      console.log(`🔄 New refreshToken: ${refreshToken.slice(0, 8)}...`);
      console.log(`⏰ New expiry: ${expiresIn} seconds`);

      amb.accessToken = accessToken;
      amb.refreshToken = refreshToken;
      amb.tokenExpiry = new Date(Date.now() + expiresIn * 1000);

      await amb.save();

      client = refreshedClient;
      console.log(`✅ Token refreshed for ${amb.twitter_handle}`);
    } catch (err) {
      console.log(`❌ Failed to refresh token for ${amb.twitter_handle}`, {
        message: err.message,
        code: err.code,
        status: err?.status,
        data: err.data || err.response?.data,
        stack: err.stack
      });

      amb.needsReauth = true;
      await amb.save();
      return;
    }
  }

  // Fetch tweets
  const tweetsData = await fetchRecentTweets(client, amb.twitterId);
  console.log(`📝 Latest tweets from ${amb.twitter_handle}:`);
  tweetsData.forEach(t => {
    console.log(`- [${t.id}] ${t.text}`);
  });

  // Load tasks
  const tasks = await Task.find({ type: "hashtag" });
  console.log(`📋 Loaded ${tasks.length} tasks:`, tasks.map(t => t.hashtags));

  // Check hashtags
  for (let tweet of tweetsData) {
    for (let task of tasks) {
      if (!task.hashtags) continue;

      const escapedHashtag = task.hashtags.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedHashtag, "i");

      if (regex.test(tweet.text)) {
        console.log(`🔍 Found match in tweet ${tweet.id} for hashtag "${task.hashtags}"`);
        const exists = await TweetLog.findOne({ tweetId: tweet.id, hashtag: task.hashtags });

        if (!exists) {
          console.log(`🟢 Logging new hashtag match for ${amb.twitter_handle}`);
          amb.totalGlobalPoints += task.points;
          amb.totalGlobalTasks += 1;
          await amb.save();

          await TweetLog.create({
            ambassadorId: amb._id,
            tweetId: tweet.id,
            projectId: task.projectId || null,
            hashtag: task.hashtags,
            pointsAwarded: task.points
          });

          if (task.projectId) {
            await projectAmbassador.findOneAndUpdate(
              { ambassadorId: amb._id, projectId: task.projectId },
              { $inc: { totalPoints: task.points, totalTasks: 1, points: task.points } },
              { upsert: true, new: true }
            );
          }

          console.log(`✅ ${amb.twitter_handle} earned ${task.points} points for hashtag "${task.hashtags}"`);
        } else {
          console.log(`⚠️ Tweet ${tweet.id} already logged for hashtag "${task.hashtags}"`);
        }
      }
    }
  }

  amb.lastCheckedAt = new Date();
  await amb.save();
  console.log(`💾 Saved ambassador ${amb.twitter_handle} progress`);
}

// === CRON JOB WITH ROUND-ROBIN QUEUE ===
function startJobs() {
  refreshAmbassadorQueue();
  cron.schedule("*/30 * * * *", refreshAmbassadorQueue);

  cron.schedule("*/15 * * * *", async () => {
    const runTime = new Date().toISOString();
    console.log(`\n🕒 [${runTime}] Running hashtag check job...`);

    try {
      if (ambassadorQueue.length === 0) {
        console.log("⚠️ Queue empty. Refreshing...");
        await refreshAmbassadorQueue();
      }

      if (ambassadorQueue.length > 0) {
        const ambData = ambassadorQueue[currentIndex];
        console.log(`👉 Checking ambassador ${currentIndex + 1}/${ambassadorQueue.length}: ${ambData.twitter_handle} (id=${ambData._id})`);

        const amb = await Ambassador.findById(ambData._id);
        if (amb) {
          await processAmbassador(amb);
        } else {
          console.log(`⚠️ Ambassador not found in DB for id=${ambData._id}`);
        }

        currentIndex = (currentIndex + 1) % ambassadorQueue.length;
      }
    } catch (err) {
      console.error("❌ Error in cron job:", {
        message: err.message,
        status: err?.status,
        data: err.data || err.response?.data,
        stack: err.stack
      });
    }

    console.log("🟢 Job finished.\n");
  });
}

module.exports = startJobs;
