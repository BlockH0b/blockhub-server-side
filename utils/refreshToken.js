const { TwitterApi } = require('twitter-api-v2');
const Ambassador = require('../modal/Ambassador'); 

async function refreshTwitterToken(ambassador) {
  try {
    if (Date.now() < ambassador.tokenExpiry - 60 * 1000) {
      // still valid (leave 1 min buffer)
      return ambassador.accessToken;
    }

    // Refresh the token
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    });

    const {
      client: refreshedClient,
      accessToken,
      refreshToken,
      expiresIn
    } = await client.refreshOAuth2Token(ambassador.refreshToken);

    // Update ambassador record
    ambassador.accessToken = accessToken;
    ambassador.refreshToken = refreshToken;
    ambassador.tokenExpiry = Date.now() + expiresIn * 1000;
    await ambassador.save();

    return accessToken;
  } catch (err) {
    console.error("Error refreshing token for", ambassador.twitter_handle, err);
    return null;
  }
}
module.exports = refreshTwitterToken;



const token = await refreshTwitterToken(ambassador);
if (!token) return; // skip if refresh failed
const client = new TwitterApi(token);
