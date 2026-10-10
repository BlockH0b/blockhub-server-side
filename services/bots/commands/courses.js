const User = require("../../../models/user");

const {
    createTelegramConnection,
} = require("../services/telegramConnection");

const {
    sendNewUserOnboarding,
} = require("../services/agent");


// ============================================================
// COURSES MESSAGE
// ============================================================

const sendCoursesMenu = async (bot, chatId) => {

    await bot.telegram.sendMessage(

        chatId,

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

};


// ============================================================
// OPEN BOT GROUP MESSAGE
// ============================================================

const sendOpenBotMessage = async (
    bot,
    ctx,
    firstName
) => {

    const groupChatId =
        ctx.chat.id;

    const coursesMessageId =
        ctx.message?.message_id;


    try {

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
            `📤 Open Bot message sent: ${botMessage.message_id}`
        );


        // ====================================================
        // DELETE BOTH AFTER 5 SECONDS
        // ====================================================

        setTimeout(async () => {

            // -----------------------------------------------
            // DELETE USER'S /COURSES MESSAGE
            // -----------------------------------------------

            if (coursesMessageId) {

                try {

                    await ctx.telegram.deleteMessage(
                        groupChatId,
                        coursesMessageId
                    );

                    console.log(
                        `🗑️ Deleted /courses message ${coursesMessageId}`
                    );

                } catch (error) {

                    console.error(
                        "❌ Could not delete /courses:",
                        error.message
                    );

                }

            }


            // -----------------------------------------------
            // DELETE BOT MESSAGE
            // -----------------------------------------------

            if (botMessage?.message_id) {

                try {

                    await ctx.telegram.deleteMessage(
                        groupChatId,
                        botMessage.message_id
                    );

                    console.log(
                        `🗑️ Deleted bot message ${botMessage.message_id}`
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
            "❌ Could not send Open Bot message:",
            error
        );


        // Still try deleting user's command
        if (coursesMessageId) {

            setTimeout(async () => {

                try {

                    await ctx.telegram.deleteMessage(
                        groupChatId,
                        coursesMessageId
                    );

                } catch (deleteError) {

                    console.error(
                        "❌ Could not delete /courses:",
                        deleteError.message
                    );

                }

            }, 5000);

        }

    }

};


// ============================================================
// DELETE GROUP COMMAND
// ============================================================

const deleteGroupCommand = (
    ctx,
    messageId
) => {

    if (!messageId) {
        return;
    }


    setTimeout(async () => {

        try {

            await ctx.telegram.deleteMessage(
                ctx.chat.id,
                messageId
            );


            console.log(
                `🗑️ Deleted group /courses message ${messageId}`
            );


        } catch (error) {

            console.error(
                "❌ Could not delete /courses message:",
                error.message
            );

        }

    }, 5000);

};


// ============================================================
// COURSES COMMAND
// ============================================================

module.exports = (bot) => {


    // ========================================================
    // /courses
    // ========================================================

    bot.command("courses", async (ctx) => {

        try {

            // =================================================
            // TELEGRAM USER
            // =================================================

            const telegramId =
                String(ctx.from.id);

            const username =
                ctx.from.username || null;

            const firstName =
                ctx.from.first_name || "there";


            // =================================================
            // CHAT TYPE
            // =================================================

            const chatType =
                ctx.chat?.type;

            const isGroup =
                chatType === "group" ||
                chatType === "supergroup";


            console.log(
                "🎓 /courses received:",
                {
                    telegramId,
                    username,
                    firstName,
                    chatType,
                    isGroup,
                }
            );


            // =================================================
            // RESPONSE CHAT
            // =================================================

            const responseChatId =
                isGroup
                    ? telegramId
                    : ctx.chat.id;


            // =================================================
            // FIND BLOCKHUB USER
            // =================================================

            const existingUser =
                await User.findOne({
                    "telegram.id": telegramId,
                });


            console.log(
                "👤 Courses user:",
                existingUser
                    ? {
                        id: existingUser._id,
                        fullName:
                            existingUser.fullName,
                        telegramId:
                            existingUser.telegram?.id,
                    }
                    : "No BlockHub user"
            );


            // =================================================
            // USER IS NOT CONNECTED TO BLOCKHUB
            // =================================================

            if (!existingUser) {

                console.log(
                    "🆕 User is not connected. Creating connection..."
                );


                const connectUrl =
                    await createTelegramConnection({
                        telegramId,
                        username,
                        firstName,
                    });


                console.log(
                    "🔗 Telegram connection created."
                );


                // ---------------------------------------------
                // SEND ONBOARDING
                // ---------------------------------------------

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
                        `📩 Onboarding sent to ${responseChatId}`
                    );


                    // -----------------------------------------
                    // DELETE GROUP COMMAND
                    // -----------------------------------------

                    if (isGroup) {

                        deleteGroupCommand(
                            ctx,
                            ctx.message?.message_id
                        );

                    }


                    return;

                } catch (dmError) {

                    console.error(
                        "❌ Could not send onboarding to DM:",
                        dmError.message
                    );


                    // -----------------------------------------
                    // IF GROUP AND BOT CANNOT DM USER
                    // -----------------------------------------

                    if (isGroup) {

                        await sendOpenBotMessage(
                            bot,
                            ctx,
                            firstName
                        );

                        return;

                    }


                    throw dmError;

                }

            }


            // =================================================
            // USER EXISTS / CONNECTED
            // =================================================

            console.log(
                "✅ User connected. Sending courses..."
            );


            try {

                await sendCoursesMenu(
                    bot,
                    responseChatId
                );


                console.log(
                    `📚 Courses menu sent to ${responseChatId}`
                );


                // ---------------------------------------------
                // DELETE GROUP /COURSES
                // ---------------------------------------------

                if (isGroup) {

                    deleteGroupCommand(
                        ctx,
                        ctx.message?.message_id
                    );

                }


            } catch (dmError) {

                console.error(
                    "❌ Could not send courses to DM:",
                    dmError.message
                );


                // ---------------------------------------------
                // BOT CANNOT MESSAGE USER
                // ---------------------------------------------

                if (isGroup) {

                    await sendOpenBotMessage(
                        bot,
                        ctx,
                        firstName
                    );

                    return;

                }


                throw dmError;

            }

        } catch (error) {

            console.error(
                "❌ /courses command error:",
                error
            );


            // =================================================
            // ERROR HANDLING
            // =================================================

            try {

                const isGroup =
                    ctx.chat?.type === "group" ||
                    ctx.chat?.type === "supergroup";


                if (isGroup) {

                    await sendOpenBotMessage(
                        bot,
                        ctx,
                        ctx.from.first_name || "there"
                    );

                    return;

                }


                await ctx.telegram.sendMessage(
                    ctx.chat.id,
                    "❌ Unable to load courses right now."
                );


            } catch (errorResponse) {

                console.error(
                    "❌ Could not send courses error:",
                    errorResponse
                );

            }

        }

    });


    // ========================================================
    // 🎓 COURSES BUTTON
    // ========================================================
    //
    // This keeps your existing button behavior.
    //
    // ========================================================

    bot.action("courses", async (ctx) => {

        try {

            await ctx.answerCbQuery();


            // =================================================
            // DELETE PREVIOUS AGENT HOME MESSAGE
            // =================================================

            try {

                await ctx.deleteMessage();

            } catch (error) {

                console.log(
                    "Could not delete previous message:",
                    error.message
                );

            }


            // =================================================
            // SEND COURSES MENU
            // =================================================

            await sendCoursesMenu(
                bot,
                ctx.chat.id
            );


        } catch (error) {

            console.error(
                "Courses action error:",
                error
            );


            try {

                await ctx.reply(
                    "❌ Unable to load courses right now."
                );

            } catch (replyError) {

                console.error(
                    "Could not send courses action error:",
                    replyError.message
                );

            }

        }

    });

};