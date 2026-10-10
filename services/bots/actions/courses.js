module.exports = (bot) => {

    bot.action("courses", async (ctx) => {

        try {

            await ctx.answerCbQuery();

            try {
                await ctx.deleteMessage();
            } catch (error) {
                console.log(
                    "Could not delete previous message:",
                    error.message
                );
            }

            await ctx.reply(

                `🎓 <b>BLOCKHUB COURSES</b>\n\n` +

                `Ready to learn something new? 🚀\n\n` +

                `Explore courses, continue your learning journey and build new skills across the BlockHub ecosystem.\n\n` +

                `Choose an option below:`,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard: [

                            [
                                {
                                    text: "📚 Explore Courses",
                                    callback_data: "explore_courses",
                                },
                            ],

                            [
                                {
                                    text: "📖 My Courses",
                                    callback_data: "my_courses",
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

        } catch (error) {

            console.error(
                "Courses action error:",
                error
            );

            await ctx.reply(
                "❌ Unable to load courses right now."
            );

        }

    });

};