const {
    sendAgentHelp,
} = require("../services/agent");


module.exports = (bot) => {

    bot.action("agent_help", async (ctx) => {

        try {

            await ctx.answerCbQuery();

            await ctx.deleteMessage();

            await sendAgentHelp(ctx);

        } catch (error) {

            console.error(
                "Agent help error:",
                error
            );

        }

    });

};