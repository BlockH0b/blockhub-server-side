const {
    sendAgentHelp,
} = require("../services/agent");

const User = require("../../../models/user");


module.exports = (bot) => {

    bot.command("help", async (ctx) => {

        try {

            // ==========================================
            // TELEGRAM USER INFORMATION
            // ==========================================

            const telegramId =
                String(ctx.from.id);

            const username =
                ctx.from.username || null;

            const firstName =
                ctx.from.first_name || "there";


            // ==========================================
            // DETECT CHAT TYPE
            // ==========================================

            const chatType =
                ctx.chat?.type;

            const isGroup =
                chatType === "group" ||
                chatType === "supergroup";


            console.log(
                "❓ /help received:",
                {
                    telegramId,
                    username,
                    firstName,
                    chatType,
                    isGroup,
                }
            );


            // ==========================================
            // PRIVATE CHAT
            // ==========================================

            if (!isGroup) {

                console.log(
                    "📩 /help received in private chat"
                );


                await sendAgentHelp(
                    bot,
                    ctx.chat.id
                );


                return;

            }


            // ==========================================
            // GROUP CHAT
            // ==========================================

            console.log(
                "👥 /help received from group"
            );


            const groupChatId =
                ctx.chat.id;

            const helpMessageId =
                ctx.message?.message_id;


            // ==========================================
            // CHECK IF USER HAS A BLOCKHUB ACCOUNT
            // ==========================================

            const existingUser =
                await User.findOne({
                    "telegram.id": telegramId,
                });


            // ==========================================
            // USER ALREADY CONNECTED
            // ==========================================

            if (existingUser) {

                console.log(
                    `✅ User ${telegramId} exists. Sending help to DM.`
                );


                try {

                    await sendAgentHelp(
                        bot,
                        telegramId
                    );


                    console.log(
                        `📩 Help sent to ${telegramId}`
                    );


                } catch (dmError) {

                    console.error(
                        "❌ Could not send help to DM:",
                        dmError
                    );


                    // Tell them to open the bot
                    // if Telegram prevents the DM.

                    const botMessage =
                        await ctx.telegram.sendMessage(
                            groupChatId,

                            `👋 <b>${firstName}</b>, I couldn't send you the help menu privately.\n\n` +
                            `Please open Agentic BlockBot first, then use /help again.`,

                            {
                                parse_mode: "HTML",

                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            {
                                                text: "🤖 Open Agentic BlockBot",
                                                url: "https://t.me/AgenticBlockBot"
                                            }
                                        ]
                                    ]
                                }
                            }
                        );


                    // --------------------------------------
                    // DELETE GROUP MESSAGES AFTER 5 SECONDS
                    // --------------------------------------

                    setTimeout(async () => {

                        try {

                            if (helpMessageId) {

                                await ctx.telegram.deleteMessage(
                                    groupChatId,
                                    helpMessageId
                                );

                            }


                            if (botMessage?.message_id) {

                                await ctx.telegram.deleteMessage(
                                    groupChatId,
                                    botMessage.message_id
                                );

                            }


                            console.log(
                                "🗑️ Deleted group /help messages"
                            );


                        } catch (deleteError) {

                            console.error(
                                "❌ Could not delete group messages:",
                                deleteError.message
                            );

                        }

                    }, 5000);


                    return;

                }


                // --------------------------------------
                // DELETE ORIGINAL /HELP MESSAGE
                // --------------------------------------

                if (helpMessageId) {

                    setTimeout(async () => {

                        try {

                            await ctx.telegram.deleteMessage(
                                groupChatId,
                                helpMessageId
                            );


                            console.log(
                                `🗑️ Deleted /help message ${helpMessageId}`
                            );


                        } catch (deleteError) {

                            console.error(
                                "❌ Could not delete /help message:",
                                deleteError.message
                            );

                        }

                    }, 5000);

                }


                return;

            }


            // ==========================================
            // USER DOES NOT HAVE BLOCKHUB ACCOUNT
            // ==========================================

            console.log(
                `🆕 User ${telegramId} has no BlockHub account`
            );


            // ==========================================
            // SEND GROUP MESSAGE
            // ==========================================

            const botMessage =
                await ctx.telegram.sendMessage(

                    groupChatId,

                    `👋 <b>${firstName}</b>, Agentic BlockBot works best in private chat.\n\n` +

                    `Open the bot below and press <b>START</b> to begin.`,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text: "🤖 Open Agentic BlockBot",
                                        url: "https://t.me/AgenticBlockBot"
                                    }
                                ]

                            ]
                        }
                    }

                );


            console.log(
                `📤 Sent group instruction message ${botMessage.message_id}`
            );


            // ==========================================
            // DELETE BOTH GROUP MESSAGES AFTER 5 SECONDS
            // ==========================================

            setTimeout(async () => {

                try {

                    // Delete user's /help
                    if (helpMessageId) {

                        await ctx.telegram.deleteMessage(
                            groupChatId,
                            helpMessageId
                        );

                    }


                    // Delete bot's response
                    if (botMessage?.message_id) {

                        await ctx.telegram.deleteMessage(
                            groupChatId,
                            botMessage.message_id
                        );

                    }


                    console.log(
                        "🗑️ Deleted /help and bot response"
                    );


                } catch (deleteError) {

                    console.error(
                        "❌ Could not delete group messages:",
                        deleteError.message
                    );

                }

            }, 5000);


        } catch (error) {

            console.error(
                "❌ Help command error:",
                error
            );


            // ==========================================
            // ERROR HANDLING
            // ==========================================

            try {

                const isGroup =
                    ctx.chat?.type === "group" ||
                    ctx.chat?.type === "supergroup";


                if (isGroup) {

                    const botMessage =
                        await ctx.telegram.sendMessage(

                            ctx.chat.id,

                            `👋 <b>${ctx.from.first_name || "there"}</b>, please open Agentic BlockBot in private chat to use /help.`,

                            {
                                parse_mode: "HTML",

                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            {
                                                text: "🤖 Open Agentic BlockBot",
                                                url: "https://t.me/AgenticBlockBot"
                                            }
                                        ]
                                    ]
                                }
                            }

                        );


                    setTimeout(async () => {

                        try {

                            // Delete user's /help
                            if (ctx.message?.message_id) {

                                await ctx.telegram.deleteMessage(
                                    ctx.chat.id,
                                    ctx.message.message_id
                                );

                            }


                            // Delete bot message
                            if (botMessage?.message_id) {

                                await ctx.telegram.deleteMessage(
                                    ctx.chat.id,
                                    botMessage.message_id
                                );

                            }

                        } catch (deleteError) {

                            console.error(
                                "❌ Error deleting error messages:",
                                deleteError.message
                            );

                        }

                    }, 5000);


                    return;

                }


                await ctx.reply(
                    "❌ Unable to load help right now."
                );


            } catch (errorResponse) {

                console.error(
                    "❌ Could not send help error:",
                    errorResponse
                );

            }

        }

    });

};