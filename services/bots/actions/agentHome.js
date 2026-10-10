const User = require("../../../models/user");

const {
    sendAgentHome,
    sendNewUserOnboarding,
    sendAgentHelp,
} = require("../services/agent");

const {
    createTelegramConnection,
} = require("../services/telegramConnection");


module.exports = (bot) => {

    bot.action("agent_home", async (ctx) => {

        try {

            await ctx.answerCbQuery();

            // Delete the previous Help/Agent message
            try {
                await ctx.deleteMessage();
            } catch (deleteError) {
                console.log(
                    "Could not delete previous message:",
                    deleteError.message
                );
            }


            // ==========================================
            // TELEGRAM USER
            // ==========================================

            const telegramId =
                String(ctx.from.id);

            const username =
                ctx.from.username || null;

            const firstName =
                ctx.from.first_name || "there";


            // ==========================================
            // CHECK BLOCKHUB ACCOUNT
            // ==========================================

            const user =
                await User.findOne({
                    "telegram.id": telegramId,
                });


            // ==========================================
            // CONNECTED USER
            // ==========================================

            if (user) {

                return sendAgentHome(
                    bot,
                    ctx.chat.id,
                    user
                );

            }


            // ==========================================
            // NOT CONNECTED
            // ==========================================

            const connectUrl =
                await createTelegramConnection({
                    telegramId,
                    username,
                    firstName,
                });


            return sendNewUserOnboarding(
                bot,
                ctx.chat.id,
                {
                    firstName,
                    connectUrl,
                }
            );


        } catch (error) {

            console.error(
                "Agent home error:",
                error
            );


            await ctx.reply(
                "❌ Something went wrong. Please try again."
            );

        }

    });

};