const User = require("../../../models/user");

module.exports = (bot) => {

    // ==========================================
    // LEADERBOARD COMMAND
    // ==========================================

    bot.command("leaderboard", async (ctx) => {

        try {

            const users =
                await User.find({
                    points: {
                        $gt: 0,
                    },
                })
                    .sort({
                        points: -1,
                    })
                    .limit(10);


            let message =
                `🏆 <b>BLOCKHUB LEADERBOARD</b>\n\n` +

                `See who's leading the BlockHub community ` +
                `and track the top performers.\n\n` +

                `━━━━━━━━━━━━━━━━━━\n\n`;


            if (users.length === 0) {

                message +=
                    `No users have earned points yet.\n\n`;

            }


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


            message +=
                `\n━━━━━━━━━━━━━━━━━━\n\n` +

                `🚀 Keep participating in BlockHub activities ` +
                `to earn more points and climb the leaderboard.`;


            await ctx.reply(

                message,

                {
                    parse_mode: "HTML",

                    reply_markup: {

                        inline_keyboard: [

                            [
                                {
                                    text: "⭐ My Points",
                                    callback_data: `my_points_${ctx.message.message_id}`,
                                },

                                {
                                    text: "👤 My Profile",
                                    url: "https://blockhubglobal.xyz/profile",
                                },
                            ],

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
                                    text: "🎮 Games",
                                    callback_data: "games",
                                },
                                {
                                    text: "🧠 Weekly Trivia",
                                    url: "https://blockhubglobal.xyz/trivia",
                                },
                            ],

                            [
                                {
                                    text: "🎯 Campaigns",
                                    callback_data: "campaigns",
                                },

                                {
                                    text: "🔎 Explore More",
                                    url: "https://blockhubglobal.xyz/profile",
                                },
                            ],

                            [
                                {
                                    text: "⚙️ Admin Settings",
                                    callback_data: `settings_${ctx.message.message_id}`,
                                },
                            ],

                            [
                                {
                                    text: "❌ Quit",
                                    callback_data:
                                        `quit_leaderboard_${ctx.message.message_id}`,
                                },
                            ],

                        ],

                    },

                }

            );


        } catch (error) {

            console.error(
                "❌ Leaderboard command error:",
                error
            );


            await ctx.reply(
                "❌ Unable to load the leaderboard right now."
            );

        }

    });

    // ==========================================
    // GAMES
    // ==========================================

    bot.action("games", async (ctx) => {

        try {

            await ctx.answerCbQuery();

            await ctx.telegram.sendMessage(

                ctx.from.id,

                `🎮 <b>BLOCKHUB GAMES</b>\n\n` +

                `Have fun, compete with the community, and earn ` +
                `points while participating in BlockHub games.\n\n` +

                `━━━━━━━━━━━━━━━━━━\n\n` +

                `🎯 <b>Games</b>\n` +
                `Coming soon...\n\n` +

                `🚀 We're currently working on exciting games ` +
                `for the BlockHub community.\n\n` +

                `Participate, compete, and earn points when ` +
                `the games go live!\n\n` +

                `━━━━━━━━━━━━━━━━━━\n\n` +

                `🔥 <b>Stay tuned for the launch!</b>`,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard: [

                            [
                                {
                                    text: "🏠 Agent Home",
                                    callback_data: "agent_home",
                                },
                            ],

                        ],
                    },

                }

            );

        } catch (error) {

            console.error(
                "❌ Games error:",
                error
            );

        }

    });


    // ==========================================
    // QUIT LEADERBOARD
    // ==========================================

    bot.action(
        /^quit_leaderboard_(\d+)$/,
        async (ctx) => {

            try {

                await ctx.answerCbQuery();


                // ==========================================
                // LEADERBOARD MESSAGE
                // ==========================================

                const leaderboardMessageId =
                    ctx.callbackQuery.message.message_id;


                // ==========================================
                // ORIGINAL /leaderboard MESSAGE
                // ==========================================

                const commandMessageId =
                    Number(ctx.match[1]);


                // ==========================================
                // DELETE LEADERBOARD
                // ==========================================

                try {

                    await ctx.telegram.deleteMessage(
                        ctx.chat.id,
                        leaderboardMessageId
                    );

                } catch (error) {

                    console.log(
                        "Could not delete leaderboard message:",
                        error.message
                    );

                }


                // ==========================================
                // DELETE USER COMMAND
                // ==========================================

                try {

                    await ctx.telegram.deleteMessage(
                        ctx.chat.id,
                        commandMessageId
                    );

                } catch (error) {

                    console.log(
                        "Could not delete /leaderboard message:",
                        error.message
                    );

                }

            } catch (error) {

                console.error(
                    "❌ Quit leaderboard error:",
                    error
                );

            }

        }
    );


    // ==========================================
    // MY POINTS
    // ==========================================

    bot.action(
        /^my_points_(\d+)$/,
        async (ctx) => {

            try {

                await ctx.answerCbQuery(
                    "📊 Loading your stats..."
                );


                // ==========================================
                // MESSAGE IDs
                // ==========================================

                const leaderboardMessageId =
                    ctx.callbackQuery.message.message_id;

                const commandMessageId =
                    Number(ctx.match[1]);


                // ==========================================
                // FIND USER
                // ==========================================

                const telegramId =
                    String(ctx.from.id);

                const user =
                    await User.findOne({
                        "telegram.id": telegramId,
                    });


                if (!user) {

                    return ctx.answerCbQuery(
                        "❌ Your BlockHub account is not connected.",
                        {
                            show_alert: true,
                        }
                    );

                }


                // ==========================================
                // CALCULATE RANK
                // ==========================================

                const usersAbove =
                    await User.countDocuments({
                        points: {
                            $gt: user.points || 0,
                        },
                    });

                const rank =
                    usersAbove + 1;


                // ==========================================
                // USER STATS
                // ==========================================

                const name =
                    user.fullName ||
                    user.twitterHandle ||
                    user.telegram?.firstName ||
                    "there";

                const points =
                    user.points || 0;

                const totalPoints =
                    user.total_points || points;

                const tasksCompleted =
                    user.tasks_completed || 0;


                // ==========================================
                // SEND PRIVATE MESSAGE
                // ==========================================

                await ctx.telegram.sendMessage(

                    ctx.from.id,

                    `⭐ <b>YOUR BLOCKHUB STATS</b>\n\n` +

                    `👤 <b>${name}</b>\n\n` +

                    `━━━━━━━━━━━━━━━━━━\n\n` +

                    `⭐ Points: <b>${points}</b>\n` +
                    `🏅 Rank: <b>#${rank}</b>\n` +
                    `🏆 Total Points: <b>${totalPoints}</b>\n` +
                    `✅ Tasks Completed: <b>${tasksCompleted}</b>\n\n` +

                    `━━━━━━━━━━━━━━━━━━\n\n` +

                    `🚀 Keep participating in BlockHub activities ` +
                    `to earn more points and climb the leaderboard.`,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text: "🎯 Campaigns",
                                        callback_data: "campaigns",
                                    },
                                    {
                                        text: "🎓 Courses",
                                        callback_data: "courses",
                                    },
                                ],

                                [
                                    {
                                        text: "💼 Jobs",
                                        callback_data: "jobs",
                                    },
                                    {
                                        text: "🏆 Rewards",
                                        callback_data: "rewards",
                                    },
                                ],

                                [
                                    {
                                        text: "🏠 Agent Home",
                                        callback_data: "agent_home",
                                    },
                                ],

                            ],
                        },

                    }

                );


                // ==========================================
                // DELETE LEADERBOARD FROM GROUP
                // ==========================================

                try {

                    await ctx.telegram.deleteMessage(
                        ctx.chat.id,
                        leaderboardMessageId
                    );

                } catch (error) {

                    console.log(
                        "Could not delete leaderboard message:",
                        error.message
                    );

                }


                // ==========================================
                // DELETE USER'S /leaderboard COMMAND
                // ==========================================

                try {

                    await ctx.telegram.deleteMessage(
                        ctx.chat.id,
                        commandMessageId
                    );

                } catch (error) {

                    console.log(
                        "Could not delete /leaderboard message:",
                        error.message
                    );

                }

            } catch (error) {

                console.error(
                    "❌ My points error:",
                    error
                );

            }

        }
    );

    bot.action(
        /^settings_(\d+)$/,
        async (ctx) => {

            try {

                await ctx.answerCbQuery();

                const chatId =
                    ctx.chat.id;

                const userId =
                    ctx.from.id;

                const commandMessageId =
                    Number(ctx.match[1]);


                // ==========================================
                // CHECK ADMIN
                // ==========================================

                const member =
                    await ctx.telegram.getChatMember(
                        chatId,
                        userId
                    );

                const isAdmin =
                    member.status === "administrator" ||
                    member.status === "creator";


                // ==========================================
                // NOT ADMIN
                // ==========================================

                if (!isAdmin) {

                    // Delete leaderboard/settings message
                    try {

                        await ctx.telegram.deleteMessage(
                            chatId,
                            ctx.callbackQuery.message.message_id
                        );

                    } catch (error) {

                        console.log(
                            "Could not delete bot message:",
                            error.message
                        );

                    }


                    // Delete user's /leaderboard message
                    try {

                        await ctx.telegram.deleteMessage(
                            chatId,
                            commandMessageId
                        );

                    } catch (error) {

                        console.log(
                            "Could not delete user message:",
                            error.message
                        );

                    }


                    return;
                }





                // ==========================================
                // ADMIN — SEND SETTINGS TO DM
                // ==========================================

                const adminId =
                    ctx.from.id;


                await ctx.telegram.sendMessage(

                    adminId,

                    `⚙️ <b>BLOCKHUB ADMIN SETTINGS</b>\n\n` +

                    `Welcome to the BlockHub admin settings.\n\n` +

                    `Choose an option below:`,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text: "➕ Manage Points",
                                        callback_data: "settings_manage_points",
                                    },
                                ],

                                [
                                    {
                                        text: "🔄 Reset Points",
                                        callback_data: "settings_reset_points",
                                    },
                                ],

                            ],
                        },

                    }

                );


                // ==========================================
                // DELETE BOT LEADERBOARD MESSAGE
                // ==========================================

                try {

                    await ctx.telegram.deleteMessage(
                        chatId,
                        ctx.callbackQuery.message.message_id
                    );

                } catch (error) {

                    console.log(
                        "Could not delete bot message:",
                        error.message
                    );

                }


                // ==========================================
                // DELETE USER'S /leaderboard MESSAGE
                // ==========================================

                try {

                    await ctx.telegram.deleteMessage(
                        chatId,
                        commandMessageId
                    );

                } catch (error) {

                    console.log(
                        "Could not delete user message:",
                        error.message
                    );

                }

            } catch (error) {

                console.error(
                    "❌ Settings error:",
                    error
                );

            }

        }
    );

    // ==========================================
    // RESET POINTS — CONFIRMATION
    // ==========================================

    bot.action("settings_reset_points", async (ctx) => {
        try {
            await ctx.answerCbQuery();

            const adminId = ctx.from.id;

            // ==========================================
            // SHOW CONFIRMATION
            // ==========================================

            await ctx.telegram.editMessageText(
                adminId,
                ctx.callbackQuery.message.message_id,
                undefined,

                `⚠️ <b>RESET LEADERBOARD</b>\n\n` +

                `Are you sure you want to reset the leaderboard?\n\n` +

                `This will reset all users' current points to <b>0</b>.\n\n` +

                `⚠️ <b>This action cannot be undone.</b>`,

                {
                    parse_mode: "HTML",


                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "✅ Yes, Reset",
                                    callback_data: "confirm_reset_points",
                                },
                                {
                                    text: "❌ No",
                                    callback_data: "cancel_reset_points",
                                },
                            ],
                        ],
                    },
                }
            );

        } catch (error) {

            console.error(
                "❌ Reset confirmation error:",
                error
            );

        }
    });


    // ==========================================
    // CONFIRM RESET POINTS
    // ==========================================

    bot.action("confirm_reset_points", async (ctx) => {
        try {
            await ctx.answerCbQuery(
                "🔄 Resetting leaderboard..."
            );

            const adminId = ctx.from.id;

            // ==========================================
            // RESET ALL CURRENT POINTS
            // ==========================================

            const result = await User.updateMany(
                {
                    points: {
                        $gt: 0,
                    },
                },
                {
                    $set: {
                        points: 0,
                    },
                }
            );

            // ==========================================
            // SHOW SUCCESS
            // ==========================================

            await ctx.telegram.editMessageText(
                adminId,
                ctx.callbackQuery.message.message_id,
                undefined,

                `✅ <b>LEADERBOARD RESET SUCCESSFULLY</b>\n\n` +

                `All users' current leaderboard points have been reset to <b>0</b>.\n\n` +

                `👥 Users affected: <b>${result.modifiedCount}</b>\n\n` +

                `🏆 The leaderboard is now empty.`,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "⚙️ Admin Settings",
                                    callback_data: "back_to_admin_settings",
                                },
                            ],
                        ],
                    },
                }
            );

        } catch (error) {

            console.error(
                "❌ Reset points error:",
                error
            );

            try {
                await ctx.answerCbQuery(
                    "❌ Failed to reset leaderboard.",
                    {
                        show_alert: true,
                    }
                );
            } catch (callbackError) {
                console.error(callbackError);
            }
        }
    });


    // ==========================================
    // CANCEL RESET POINTS
    // ==========================================

    bot.action("cancel_reset_points", async (ctx) => {
        try {
            await ctx.answerCbQuery();

            const adminId = ctx.from.id;

            await ctx.telegram.editMessageText(
                adminId,
                ctx.callbackQuery.message.message_id,
                undefined,

                `⚙️ <b>BLOCKHUB ADMIN SETTINGS</b>\n\n` +

                `Welcome to the BlockHub admin settings.\n\n` +

                `Choose an option below:`,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "➕ Manage Points",
                                    callback_data: "settings_manage_points",
                                },
                            ],
                            [
                                {
                                    text: "🔄 Reset Points",
                                    callback_data: "settings_reset_points",
                                },
                            ],
                        ],
                    },
                }
            );

        } catch (error) {

            console.error(
                "❌ Cancel reset error:",
                error
            );

        }
    });


    // ==========================================
    // BACK TO ADMIN SETTINGS
    // ==========================================

    bot.action("back_to_admin_settings", async (ctx) => {
        try {
            await ctx.answerCbQuery();

            const adminId = ctx.from.id;

            await ctx.telegram.editMessageText(
                adminId,
                ctx.callbackQuery.message.message_id,
                undefined,

                `⚙️ <b>BLOCKHUB ADMIN SETTINGS</b>\n\n` +

                `Welcome to the BlockHub admin settings.\n\n` +

                `Choose an option below:`,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "➕ Manage Points",
                                    callback_data: "settings_manage_points",
                                },
                            ],
                            [
                                {
                                    text: "🔄 Reset Points",
                                    callback_data: "settings_reset_points",
                                },
                            ],
                        ],
                    },
                }
            );

        } catch (error) {

            console.error(
                "❌ Back to admin settings error:",
                error
            );

        }
    });
    // ==========================================
    // MANAGE POINTS
    // ==========================================

    bot.action("settings_manage_points", async (ctx) => {

        try {

            await ctx.answerCbQuery();

            const adminId = ctx.from.id;

            // ==========================================
            // GET USERS WITH POINTS
            // ==========================================

            const users =
                await User.find({
                    "telegram.id": {
                        $exists: true,
                        $ne: null,
                    },
                })
                    .sort({
                        points: -1,
                        fullName: 1,
                    });


            // ==========================================
            // NO USERS
            // ==========================================

            if (users.length === 0) {

                return ctx.telegram.sendMessage(

                    adminId,

                    `👥 <b>MANAGE USER POINTS</b>\n\n` +

                    `No users currently have points.`,

                    {
                        parse_mode: "HTML",
                    }
                );

            }


            // ==========================================
            // BUILD USER BUTTONS
            // ==========================================

            const buttons = [];


            users.forEach((user) => {

                const name =
                    user.fullName ||
                    user.twitterHandle ||
                    user.telegram?.firstName ||
                    "Unknown User";

                buttons.push([

                    {
                        text:
                            `👤 ${name} — ${user.points || 0} pts`,

                        callback_data:
                            `edit_points_${user._id}`,
                    },

                ]);

            });


            // ==========================================
            // ADD CLOSE BUTTON
            // ==========================================

            buttons.push([

                {
                    text: "❌ Close",
                    callback_data: "close_manage_points",
                },

            ]);


            // ==========================================
            // SEND USER LIST TO ADMIN
            // ==========================================

            await ctx.telegram.sendMessage(

                adminId,

                `👥 <b>MANAGE USER POINTS</b>\n\n` +

                `Select a user below to edit their points.\n\n` +

                `━━━━━━━━━━━━━━━━━━\n\n` +

                `💡 <b>Click a user to continue.</b>`,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard: buttons,
                    },
                }

            );


            // ==========================================
            // DELETE PREVIOUS ADMIN SETTINGS MESSAGE
            // ==========================================

            try {

                await ctx.telegram.deleteMessage(
                    adminId,
                    ctx.callbackQuery.message.message_id
                );

            } catch (error) {

                console.log(
                    "Could not delete admin settings message:",
                    error.message
                );

            }

        } catch (error) {

            console.error(
                "❌ Manage points error:",
                error
            );

        }

    });


    // ==========================================
    // EDIT USER POINTS
    // ==========================================

    bot.action(
        /^edit_points_(.+)$/,
        async (ctx) => {

            try {

                await ctx.answerCbQuery();

                const adminId =
                    ctx.from.id;

                const userId =
                    ctx.match[1];


                // ==========================================
                // FIND USER
                // ==========================================

                const user =
                    await User.findById(userId);


                if (!user) {

                    return ctx.answerCbQuery(
                        "❌ User not found.",
                        {
                            show_alert: true,
                        }
                    );

                }


                const name =
                    user.fullName ||
                    user.twitterHandle ||
                    user.telegram?.firstName ||
                    "Unknown User";

                const points =
                    user.points || 0;


                // ==========================================
                // SAVE ADMIN EDITING STATE
                // ==========================================

                // Store the user currently being edited
                // against the admin's Telegram ID.

                bot.pointEditing =
                    bot.pointEditing || new Map();

                bot.pointEditing.set(
                    String(adminId),
                    String(user._id)
                );


                // ==========================================
                // SEND EDIT INSTRUCTION
                // ==========================================

                await ctx.telegram.sendMessage(

                    adminId,

                    `✏️ <b>EDIT USER POINTS</b>\n\n` +

                    `👤 User: <b>${name}</b>\n` +

                    `⭐ Current Points: <b>${points}</b>\n\n` +

                    `━━━━━━━━━━━━━━━━━━\n\n` +

                    `Please send the amount you want to change.\n\n` +

                    `➕ <code>+50</code> — Add 50 points\n` +

                    `➖ <code>-50</code> — Remove 50 points\n\n` +

                    `Example:\n` +

                    `<code>+100</code>\n\n` +

                    `or\n\n` +

                    `<code>-25</code>`,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text: "⬅️ Cancel",
                                        callback_data: "settings_manage_points",
                                    },
                                ],

                            ],
                        },

                    }

                );


                // ==========================================
                // DELETE USER LIST
                // ==========================================

                try {

                    await ctx.telegram.deleteMessage(
                        adminId,
                        ctx.callbackQuery.message.message_id
                    );

                } catch (error) {

                    console.log(
                        "Could not delete user list:",
                        error.message
                    );

                }

            } catch (error) {

                console.error(
                    "❌ Edit points error:",
                    error
                );

            }

        }
    );


    // ==========================================
    // RECEIVE POINT CHANGE
    // ==========================================

    bot.on("text", async (ctx, next) => {

        try {

            const adminId =
                ctx.from.id;

            const editingUserId =
                bot.pointEditing?.get(
                    String(adminId)
                );


            // ==========================================
            // ADMIN IS NOT EDITING POINTS
            // ==========================================

            if (!editingUserId) {

                return next();

            }


            const text =
                ctx.message.text.trim();


            // ==========================================
            // VALIDATE INPUT
            // ==========================================

            if (!/^[+-]\d+$/.test(text)) {

                await ctx.reply(

                    `❌ Invalid format.\n\n` +

                    `Please send:\n` +

                    `<code>+50</code> to add points\n` +

                    `<code>-50</code> to remove points.`,

                    {
                        parse_mode: "HTML",
                    }

                );

                return;

            }


            const change =
                Number(text);


            if (change === 0) {

                await ctx.reply(
                    `❌ The point change cannot be 0.`
                );

                return;

            }


            // ==========================================
            // FIND USER
            // ==========================================

            const user =
                await User.findById(editingUserId);


            if (!user) {

                bot.pointEditing.delete(
                    String(adminId)
                );

                return ctx.reply(
                    `❌ User no longer exists.`
                );

            }


            const currentPoints =
                user.points || 0;


            const newPoints =
                currentPoints + change;


            // ==========================================
            // PREVENT NEGATIVE POINTS
            // ==========================================

            if (newPoints < 0) {

                return ctx.reply(

                    `❌ This would make the user's points negative.\n\n` +

                    `Current points: <b>${currentPoints}</b>`,

                    {
                        parse_mode: "HTML",
                    }

                );

            }


            // ==========================================
            // UPDATE POINTS
            // ==========================================

            user.points =
                newPoints;

            await user.save();


            const name =
                user.fullName ||
                user.twitterHandle ||
                user.telegram?.firstName ||
                "Unknown User";


            // ==========================================
            // REMOVE EDITING STATE
            // ==========================================

            bot.pointEditing.delete(
                String(adminId)
            );


            // ==========================================
            // DELETE ADMIN'S COMMAND
            // ==========================================

            try {

                await ctx.telegram.deleteMessage(
                    adminId,
                    ctx.message.message_id
                );

            } catch (error) {

                console.log(
                    "Could not delete admin point message:",
                    error.message
                );

            }


            // ==========================================
            // SUCCESS MESSAGE
            // ==========================================

            await ctx.telegram.sendMessage(

                adminId,

                `✅ <b>POINTS UPDATED SUCCESSFULLY</b>\n\n` +

                `👤 User: <b>${name}</b>\n\n` +

                `⭐ Previous Points: <b>${currentPoints}</b>\n` +

                `📊 Change: <b>${change > 0 ? "+" : ""}${change}</b>\n` +

                `🏆 New Points: <b>${newPoints}</b>\n\n` +

                `The user points have been updated successfully.`,

                {
                    parse_mode: "HTML",
                }

            );


            // ==========================================
            // RETURN TO USER LIST AFTER 5 SECONDS
            // ==========================================

            setTimeout(
                async () => {

                    try {
                        const users =
                            await User.find({
                                "telegram.id": {
                                    $exists: true,
                                    $ne: null,
                                },
                            })
                                .sort({
                                    points: -1,
                                    fullName: 1,
                                });


                        const buttons = [];


                        users.forEach((user) => {

                            const name =
                                user.fullName ||
                                user.twitterHandle ||
                                user.telegram?.firstName ||
                                "Unknown User";


                            buttons.push([

                                {
                                    text:
                                        `👤 ${name} — ${user.points || 0} pts`,

                                    callback_data:
                                        `edit_points_${user._id}`,
                                },

                            ]);

                        });


                        buttons.push([

                            {
                                text: "❌ Close",
                                callback_data: "close_manage_points",
                            },

                        ]);


                        await ctx.telegram.sendMessage(

                            adminId,

                            `👥 <b>MANAGE USER POINTS</b>\n\n` +

                            `Select a user below to edit their points.\n\n` +

                            `━━━━━━━━━━━━━━━━━━\n\n` +

                            `💡 <b>Click a user to continue.</b>`,

                            {
                                parse_mode: "HTML",

                                reply_markup: {
                                    inline_keyboard: buttons,
                                },
                            }

                        );

                    } catch (error) {

                        console.error(
                            "❌ Failed to reload user list:",
                            error
                        );

                    }

                },

                5000

            );


        } catch (error) {

            console.error(
                "❌ Point update error:",
                error
            );

        }

    });


    // ==========================================
    // CLOSE MANAGE POINTS
    // ==========================================

    bot.action(
        "close_manage_points",
        async (ctx) => {

            try {

                await ctx.answerCbQuery();


                await ctx.telegram.deleteMessage(

                    ctx.from.id,

                    ctx.callbackQuery.message.message_id

                );

            } catch (error) {

                console.log(
                    "Could not close manage points:",
                    error.message
                );

            }

        }
    );

};