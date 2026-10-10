const User = require("../../../models/user");

module.exports = (bot) => {

    bot.action("show_leaderboard", async (ctx) => {

        try {

            // Remove Telegram's loading state
            await ctx.answerCbQuery();


            // ==========================================
            // GET TOP 10 USERS
            // ==========================================

            const users = await User.find({
                points: {
                    $gt: 0,
                },
            })
                .sort({
                    points: -1,
                })
                .limit(10);


            // ==========================================
            // NO USERS
            // ==========================================

            if (users.length === 0) {

                return ctx.reply(
                    "🏆 <b>BLOCKHUB LEADERBOARD</b>\n\n" +
                    "No users have earned points yet.",
                    {
                        parse_mode: "HTML",
                    }
                );

            }


            // ==========================================
            // BUILD MESSAGE
            // ==========================================

            let message =
                "🏆 <b>BLOCKHUB LEADERBOARD</b>\n\n";


            users.forEach((user, index) => {

                const name =
                    user.fullName ||
                    user.twitterHandle ||
                    user.telegram?.firstName ||
                    "Unknown User";


                let position;


                if (index === 0) {

                    position = "🥇";

                } else if (index === 1) {

                    position = "🥈";

                } else if (index === 2) {

                    position = "🥉";

                } else {

                    position = `${index + 1}.`;

                }


                message +=
                    `${position} <b>${name}</b> — ` +
                    `<b>${user.points || 0}</b> pts\n`;

            });


            // ==========================================
            // SEND LEADERBOARD
            // ==========================================

            await ctx.reply(
                message,
                {
                    parse_mode: "HTML",
                }
            );


        } catch (error) {

            console.error(
                "Leaderboard action error:",
                error
            );


            await ctx.reply(
                "❌ Unable to load the leaderboard right now."
            );

        }

    });

};