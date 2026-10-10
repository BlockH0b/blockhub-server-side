const { Telegraf } = require("telegraf");

const startCommand = require("./commands/start");
const helpCommand = require("./commands/help");

const agentHomeAction = require("./actions/agentHome");
const agentHelpAction = require("./actions/agentHelp");
const leaderboardAction = require("./actions/leaderboard");
const leaderboardCommand = require("./commands/leaderboard");
const coursesAction = require("./actions/courses");
const exploreCourses = require("./actions/exploreCourses");
const setHeartAndHonored = require("./actions/jobs");
const myCoursesAction = require("./actions/myCourses");
const courses = require("./commands/courses");




const bot = new Telegraf(
    process.env.TELEGRAM_BOT_TOKEN
);


// ==========================================
// COMMANDS
// ==========================================

startCommand(bot);

helpCommand(bot);

leaderboardCommand(bot);

courses(bot);


// ==========================================
// ACTIONS
// ==========================================

agentHomeAction(bot);

agentHelpAction(bot);

leaderboardAction(bot);

coursesAction(bot);

exploreCourses(bot);

setHeartAndHonored(bot);

myCoursesAction(bot);

// ==========================================
// EXPORT
// ==========================================


// ==========================================
// UNKNOWN COMMAND HANDLER
// ==========================================

bot.on("message", async (ctx, next) => {

    try {

        // Only handle text messages that are commands
        if (
            !ctx.message ||
            !ctx.message.text ||
            !ctx.message.text.startsWith("/")
        ) {
            return next();
        }


        const command =
            ctx.message.text
                .split(" ")[0]
                .split("@")[0];


        // ==========================================
        // COMMANDS THAT ALREADY EXIST
        // ==========================================

        const availableCommands = [
            "/start",
            "/help",
            "/leaderboard",
            "/courses",
        ];


        // ==========================================
        // IGNORE REGISTERED COMMANDS
        // ==========================================

        if (availableCommands.includes(command)) {
            return next();
        }


        // ==========================================
        // SEND COMING SOON MESSAGE
        // ==========================================

        const response =
            await ctx.reply(

                `🚀 <b>COMING SOON</b>\n\n` +

                `The <b>${command}</b> feature is currently ` +
                `being worked on.\n\n` +

                `Stay tuned — exciting things are coming ` +
                `to the BlockHub community! 🔥`,

                {
                    parse_mode: "HTML",
                }

            );


        // ==========================================
        // DELETE BOTH AFTER 5 SECONDS
        // ==========================================

        setTimeout(async () => {

            try {

                // Delete bot response
                await ctx.telegram.deleteMessage(
                    ctx.chat.id,
                    response.message_id
                );

            } catch (error) {

                console.log(
                    "Could not delete bot response:",
                    error.message
                );

            }


            try {

                // Delete user's command
                await ctx.telegram.deleteMessage(
                    ctx.chat.id,
                    ctx.message.message_id
                );

            } catch (error) {

                console.log(
                    "Could not delete user command:",
                    error.message
                );

            }

        }, 5000);


    } catch (error) {

        console.error(
            "❌ Unknown command handler error:",
            error
        );

    }

});

module.exports = bot;