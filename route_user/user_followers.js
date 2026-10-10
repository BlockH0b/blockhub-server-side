require('dotenv').config();
const express = require('express');
const { TwitterApi } = require('twitter-api-v2');
const router = express.Router();

// Initialize Twitter client (OAuth2)
const twitterClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
});

// Endpoint: GET /user/followers/:id

router.get('/followers/:id', async(req, res) => {
    try {
        const userAccessToken = "YmRaNzN5MlE4Z0cxdTg5TlZSVlJGLXhOd3pvc3luRzdXa3ZyQXN5c2FSeDMwOjE3NTUxNTEyNzIxOTg6MTowOmF0OjE"
        const userId = req.params.id;

        // Create a read-only client using your app's bearer token
        const userClient = new TwitterApi(userAccessToken);

        let followers = [];
        let paginationToken = undefined;

        do {
            const response = await userClient.v2.followers(userId, {
                max_results: 1000,
                'user.fields': ['id', 'name', 'username', 'profile_image_url', 'verified'],
                pagination_token: paginationToken,
            });

            followers = followers.concat(response.data || []);
            paginationToken = response.meta.next_token;
        } while (paginationToken);

        res.json({ count: followers.length, followers });
    } catch (err) {
        console.error('Error fetching followers:', err);
        res.status(500).json({ error: 'Unable to fetch followers' });
    }
});

module.exports = router;