const User = require("../../../models/user");


// ==========================================
// AGENT HOME
// ==========================================

const sendAgentHome = async (bot, chatId, user) => {

    if (!user) {
        console.error(
            "❌ sendAgentHome called without a user:",
            {
                chatId,
            }
        );

        return bot.telegram.sendMessage(
            chatId,
            "❌ I couldn't find your BlockHub account. Please connect your account first."
        );
    }


    const name =
        user.fullName ||
        user.twitterHandle ||
        user.telegram?.firstName ||
        "there";

    const points =
        user.points || 0;


    const usersAbove =
        await User.countDocuments({
            points: {
                $gt: points,
            },
        });


    const rank =
        usersAbove + 1;


    await bot.telegram.sendMessage(

        chatId,

        `👋 <b>Welcome back, ${name}!</b>\n\n` +

        `🤖 <b>Agentic BlockBot is ready.</b>\n\n` +

        `Your BlockHub account is connected and I'm ready to help you explore the ecosystem, discover opportunities, complete activities and earn.\n\n` +

        `━━━━━━━━━━━━━━━━━━\n\n` +

        `🏆 <b>Your BlockHub Stats</b>\n\n` +

        `⭐ Points: <b>${points}</b>\n` +
        `🏅 Rank: <b>#${rank}</b>\n\n` +

        `What would you like to explore?\n\n` +

        `🎓 Learn something new\n` +
        `💼 Find jobs & opportunities\n` +
        `🎯 Explore campaigns\n` +
        `🧠 Join weekly trivia\n` +
        `🏆 Check your rewards\n\n` +

        `⚡ <b>Your agent can help you discover and execute BlockHub activities directly from Telegram.</b>\n\n` +

        `Need help? Use <code>/help</code>.`,

        {
            parse_mode: "HTML",

            reply_markup: {
                inline_keyboard: [

                    [
                        {
                            text: "🎓 Courses",
                            callback_data: "courses",
                        },
                        {
                            text: "💼 Jobs",
                            callback_data: "jobs",
                        },
                    ],

                    [
                        {
                            text: "🎯 Campaigns",
                            callback_data: "campaigns",
                        },
                        {
                            text: "🧠 Weekly Trivia",
                            callback_data: "trivia",
                        },
                    ],

                    [
                        {
                            text: "🏆 My Rewards",
                            callback_data: "rewards",
                        },
                        {
                            text: "📊 My Stats",
                            callback_data: "my_stats",
                        },
                    ],

                    [
                        {
                            text: "🔎 Explore BlockHub",
                            callback_data: "explore",
                        },
                    ],

                    [
                        {
                            text: "❓ Help",
                            callback_data: "agent_help",
                        },
                    ],

                ],
            },
        }

    );
};


// ==========================================
// NEW USER ONBOARDING
// ==========================================

const sendNewUserOnboarding = async (
    bot,
    chatId,
    {
        firstName,
        connectUrl,
    }
) => {

    await bot.telegram.sendMessage(

        chatId,

        `👋 <b>Welcome to Agentic BlockBot, ${firstName}!</b>\n\n` +

        `🤖 I'm your personal agent for the <b>BlockHub ecosystem</b>.\n\n` +

        `From Telegram, you can discover opportunities, join campaigns, learn, earn and complete everyday BlockHub activities without constantly leaving Telegram.\n\n` +

        `🚀 <b>Once connected, you can:</b>\n\n` +

        `🎓 Discover courses & learning opportunities\n` +
        `💼 Find jobs, gigs & opportunities\n` +
        `🎯 Discover and join campaigns\n` +
        `🏆 Track points, XP & rewards\n` +
        `🧠 Participate in weekly trivia\n` +
        `🔔 Receive important ecosystem updates\n` +
        `⚡ Execute supported BlockHub activities\n\n` +

        `Connect your BlockHub account to unlock your personal agent.\n\n` +

        `👇 <b>Let's get you connected.</b>`,

        {
            parse_mode: "HTML",

            reply_markup: {
                inline_keyboard: [

                    [
                        {
                            text: "🔗 Connect BlockHub Account",
                            url: connectUrl,
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

};


// ==========================================
// AGENT HELP
// ==========================================

const sendAgentHelp = async (bot, chatId) => {

    await bot.telegram.sendMessage(

        chatId,

        `🤖 <b>AGENTIC BLOCKBOT</b>\n\n` +

        `Your personal agent for the <b>BlockHub ecosystem</b>.\n\n` +

        `I help you discover opportunities, learn, participate, earn and complete BlockHub activities directly from Telegram.\n\n` +

        `━━━━━━━━━━━━━━━━━━\n\n` +

        `🎓 <b>COURSES & LEARNING</b>\n` +
        `Discover courses, get recommendations and track your learning progress.\n\n` +

        `💼 <b>JOBS & OPPORTUNITIES</b>\n` +
        `Discover jobs, gigs and other opportunities available across the ecosystem.\n\n` +

        `🎯 <b>CAMPAIGNS</b>\n` +
        `Discover campaigns, check eligibility, complete tasks and track rewards.\n\n` +

        `🏆 <b>REWARDS</b>\n` +
        `Track your XP, points, achievements and supported rewards.\n\n` +

        `🧠 <b>WEEKLY TRIVIA</b>\n` +
        `Test your Web3 knowledge, compete with the community and win rewards.\n\n` +

        `🔔 <b>NOTIFICATIONS</b>\n` +
        `Stay updated on important jobs, courses, campaigns and BlockHub announcements.\n\n` +

        `⚡ <b>BLOCKHUB ACTIONS</b>\n` +
        `Execute supported BlockHub activities directly from Telegram.\n\n` +

        `━━━━━━━━━━━━━━━━━━\n\n` +

        `💡 <b>QUICK COMMANDS</b>\n\n` +

        `/start — Open your Agentic BlockBot home\n` +
        `/help — See what I can do\n` +
        `/leaderboard — View the BlockHub leaderboard\n` +
        `/profile — View your BlockHub profile\n\n` +

        `🚀 <b>BlockBot doesn't just tell you what to do. It helps you get it done.</b>`,

        {
            parse_mode: "HTML",

            reply_markup: {
                inline_keyboard: [

                    [
                        {
                            text: "🎓 Courses",
                            callback_data: "courses",
                        },
                        {
                            text: "💼 Jobs",
                            callback_data: "jobs",
                        },
                    ],

                    [
                        {
                            text: "🎯 Campaigns",
                            callback_data: "campaigns",
                        },
                        {
                            text: "🧠 Trivia",
                            callback_data: "trivia",
                        },
                    ],

                    [
                        {
                            text: "🏆 Rewards",
                            callback_data: "rewards",
                        },
                        {
                            text: "👤 My Profile",
                            callback_data: "my_stats",
                        },
                    ],

                    [
                        {
                            text: "⬅️ Back to Agent",
                            callback_data: "agent_home",
                        },
                    ],

                ],
            },
        }

    );

};


module.exports = {
    sendAgentHome,
    sendNewUserOnboarding,
    sendAgentHelp,
};