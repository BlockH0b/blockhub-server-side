const User = require("../../../models/user");

const {
    createTelegramConnection,
} = require("../services/telegramConnection");

const {
    sendAgentHome,
    sendNewUserOnboarding,
} = require("../services/agent");


// ============================================================
// START COMMAND
// ============================================================

module.exports = (bot) => {

    bot.start(async (ctx) => {

        // ====================================================
        // TELEGRAM USER INFORMATION
        // ====================================================

        const telegramId =
            String(ctx.from.id);

        const username =
            ctx.from.username || null;

        const firstName =
            ctx.from.first_name || "there";


        // ====================================================
        // DETECT CHAT TYPE
        // ====================================================

        const chatType =
            ctx.chat?.type;

        const isGroup =
            chatType === "group" ||
            chatType === "supergroup";


        console.log(
            "🚀 /start received:",
            {
                telegramId,
                username,
                firstName,
                chatType,
                isGroup,
            }
        );


        // ====================================================
        // GROUP INFORMATION
        // ====================================================

        const groupChatId =
            isGroup
                ? ctx.chat.id
                : null;

        const startMessageId =
            isGroup
                ? ctx.message?.message_id
                : null;


        // ====================================================
        // RESPONSE CHAT
        // ====================================================
        //
        // GROUP:
        //      Send everything to user's private DM.
        //
        // PRIVATE:
        //      Respond in current private chat.
        //
        // ====================================================

        const responseChatId =
            isGroup
                ? telegramId
                : ctx.chat.id;


        console.log(
            "📤 Response will be sent to:",
            responseChatId
        );


        try {

            // =================================================
            // CHECK EXISTING BLOCKHUB ACCOUNT
            // =================================================

            const existingUser =
                await User.findOne({
                    "telegram.id": telegramId,
                });


            console.log(
                "👤 Existing BlockHub user:",
                existingUser
                    ? {
                        id: existingUser._id,
                        fullName: existingUser.fullName,
                        twitterHandle:
                            existingUser.twitterHandle,
                        telegramId:
                            existingUser.telegram?.id,
                    }
                    : "No user found"
            );


            // =================================================
            // EXISTING USER
            // =================================================

            if (existingUser) {

                console.log(
                    "✅ Existing user."
                );


                try {

                    await sendAgentHome(
                        bot,
                        responseChatId,
                        existingUser
                    );


                    console.log(
                        `📩 Agent Home sent to ${responseChatId}`
                    );


                } catch (dmError) {

                    // =========================================
                    // USER HAS NOT STARTED BOT PRIVATELY
                    // =========================================

                    console.error(
                        "❌ Could not send Agent Home to DM:",
                        dmError.message
                    );


                    if (isGroup) {

                        await sendOpenBotMessage(
                            bot,
                            ctx,
                            groupChatId,
                            startMessageId,
                            firstName
                        );

                        return;

                    }


                    throw dmError;

                }

            }


            // =================================================
            // NEW USER
            // =================================================

            else {

                console.log(
                    "🆕 New Telegram user."
                );


                // =============================================
                // CREATE TELEGRAM CONNECTION
                // =============================================

                const connectUrl =
                    await createTelegramConnection({
                        telegramId,
                        username,
                        firstName,
                    });


                console.log(
                    "🔗 Telegram connection created."
                );


                try {

                    await sendNewUserOnboarding(
                        bot,
                        responseChatId,
                        {
                            firstName,
                            connectUrl,
                        }
                    );


                    console.log(
                        `📩 New user onboarding sent to ${responseChatId}`
                    );


                } catch (dmError) {

                    // =========================================
                    // USER HAS NOT STARTED BOT PRIVATELY
                    // =========================================

                    console.error(
                        "❌ Could not send onboarding to DM:",
                        dmError.message
                    );


                    if (isGroup) {

                        await sendOpenBotMessage(
                            bot,
                            ctx,
                            groupChatId,
                            startMessageId,
                            firstName
                        );

                        return;

                    }


                    throw dmError;

                }

            }


            // =================================================
            // DELETE GROUP /START MESSAGE
            // =================================================

            if (isGroup) {

                scheduleGroupMessageDeletion(
                    ctx,
                    groupChatId,
                    startMessageId
                );

            }


        } catch (error) {

            console.error(
                "❌ Start command error:",
                error
            );


            // =================================================
            // GROUP ERROR
            // =================================================

            if (isGroup) {

                try {

                    await sendOpenBotMessage(
                        bot,
                        ctx,
                        groupChatId,
                        startMessageId,
                        firstName
                    );

                    return;

                } catch (groupError) {

                    console.error(
                        "❌ Could not send group fallback:",
                        groupError
                    );

                    return;

                }

            }


            // =================================================
            // PRIVATE ERROR
            // =================================================

            try {

                await ctx.telegram.sendMessage(
                    ctx.chat.id,

                    "❌ Something went wrong. Please try again."
                );

            } catch (errorResponse) {

                console.error(
                    "❌ Could not send private error:",
                    errorResponse
                );

            }

        }

    });

};


// ============================================================
// SEND "OPEN AGENTIC BLOCKBOT" MESSAGE
// ============================================================

async function sendOpenBotMessage(
    bot,
    ctx,
    groupChatId,
    startMessageId,
    firstName
) {

    try {

        console.log(
            `📢 Sending Open Bot message to group ${groupChatId}`
        );


        const botMessage =
            await bot.telegram.sendMessage(

                groupChatId,

                `👋 <b>${firstName}</b>, let's continue in private chat.\n\n` +

                `Open Agentic BlockBot and press <b>START</b> to continue.`,

                {
                    parse_mode: "HTML",

                    reply_markup: {

                        inline_keyboard: [

                            [

                                {
                                    text:
                                        "🤖 Open Agentic BlockBot",

                                    url:
                                        "https://t.me/AgenticBlockBot",
                                },

                            ],

                        ],

                    },

                }

            );


        console.log(
            `📤 Bot fallback message sent: ${botMessage.message_id}`
        );


        // ====================================================
        // DELETE BOTH MESSAGES AFTER 5 SECONDS
        // ====================================================

        setTimeout(async () => {

            // -----------------------------------------------
            // DELETE USER'S /START MESSAGE
            // -----------------------------------------------

            if (startMessageId) {

                try {

                    await ctx.telegram.deleteMessage(
                        groupChatId,
                        startMessageId
                    );


                    console.log(
                        `🗑️ Deleted group /start message ${startMessageId}`
                    );

                } catch (error) {

                    console.error(
                        "❌ Could not delete /start message:",
                        error.message
                    );

                }

            }


            // -----------------------------------------------
            // DELETE BOT'S MESSAGE
            // -----------------------------------------------

            if (botMessage?.message_id) {

                try {

                    await ctx.telegram.deleteMessage(
                        groupChatId,
                        botMessage.message_id
                    );


                    console.log(
                        `🗑️ Deleted bot group message ${botMessage.message_id}`
                    );

                } catch (error) {

                    console.error(
                        "❌ Could not delete bot message:",
                        error.message
                    );

                }

            }

        }, 5000);


        return botMessage;


    } catch (error) {

        console.error(
            "❌ Could not send Open Bot group message:",
            error
        );


        // ====================================================
        // STILL TRY TO DELETE USER'S /START
        // ====================================================

        if (startMessageId) {

            setTimeout(async () => {

                try {

                    await ctx.telegram.deleteMessage(
                        groupChatId,
                        startMessageId
                    );

                    console.log(
                        `🗑️ Deleted /start message ${startMessageId}`
                    );

                } catch (deleteError) {

                    console.error(
                        "❌ Could not delete /start:",
                        deleteError.message
                    );

                }

            }, 5000);

        }


        throw error;

    }

}


// ============================================================
// DELETE ORIGINAL GROUP MESSAGE
// ============================================================

function scheduleGroupMessageDeletion(
    ctx,
    groupChatId,
    messageId
) {

    if (!messageId) {
        return;
    }


    setTimeout(async () => {

        try {

            await ctx.telegram.deleteMessage(
                groupChatId,
                messageId
            );


            console.log(
                `🗑️ Deleted /start message ${messageId} from group ${groupChatId}`
            );


        } catch (error) {

            console.error(
                "❌ Could not delete /start message:",
                error.message
            );

        }

    }, 5000);

}