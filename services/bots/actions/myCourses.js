const User = require("../../../models/user");
const Enrollment = require("../../../models/Enrollment");

module.exports = (bot) => {

    // ============================================================
    // MY COURSES
    // ============================================================

    bot.action("my_courses", async (ctx) => {

        try {

            await ctx.answerCbQuery();

            // Delete previous Courses screen
            try {
                await ctx.deleteMessage();
            } catch (error) {
                console.log(
                    "Could not delete previous message:",
                    error.message
                );
            }


            // ====================================================
            // GET TELEGRAM USER
            // ====================================================

            const telegramId =
                String(ctx.from.id);


            // ====================================================
            // FIND BLOCKHUB USER
            // ====================================================

            const user =
                await User.findOne({
                    "telegram.id": telegramId,
                });


            if (!user) {

                return ctx.reply(

                    `🔐 <b>Account Not Connected</b>\n\n` +

                    `Your Telegram account is not connected to a BlockHub account yet.\n\n` +

                    `Connect your account first to access your courses.`,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text: "🔗 Connect BlockHub Account",
                                        url:
                                            "https://blockhubglobal.xyz/connect-telegram",
                                    },
                                ],

                                [
                                    {
                                        text: "🏠 Back to Agent",
                                        callback_data: "agent_home",
                                    },
                                ],

                            ],
                        },
                    }

                );

            }


            // ====================================================
            // GET USER ENROLLMENTS
            // ====================================================

            const enrollments =
                await Enrollment.find({
                    user: user._id,
                })
                .populate({
                    path: "course",
                    populate: {
                        path: "tutor",
                        populate: {
                            path: "user",
                            select:
                                "fullName twitterHandle profileImage bio",
                        },
                    },
                })
                .sort({
                    createdAt: -1,
                });


            // Remove enrollments whose course no longer exists
            const validEnrollments =
                enrollments.filter(
                    enrollment => enrollment.course
                );


            // ====================================================
            // NO COURSES
            // ====================================================

            if (validEnrollments.length === 0) {

                return ctx.reply(

                    `📖 <b>MY COURSES</b>\n\n` +

                    `You haven't enrolled in any courses yet.\n\n` +

                    `Ready to start learning? Explore the courses available across the BlockHub ecosystem. 🚀`,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text: "📚 Explore Courses",
                                        callback_data:
                                            "explore_courses",
                                    },
                                ],

                                [
                                    {
                                        text: "🌐 Explore More",
                                        url:
                                            "https://blockhubglobal.xyz/courses",
                                    },
                                ],

                                [
                                    {
                                        text: "⬅️ Back to Courses",
                                        callback_data: "courses",
                                    },
                                ],

                                [
                                    {
                                        text: "🏠 Back to Agent",
                                        callback_data: "agent_home",
                                    },
                                ],

                            ],
                        },
                    }

                );

            }


            // ====================================================
            // BUILD MY COURSES LIST
            // ====================================================

            let message =
                `📖 <b>MY COURSES</b>\n\n`;

            message +=
                `Here are the courses you're currently enrolled in:\n\n`;


            validEnrollments.forEach(
                (enrollment, index) => {

                    const course =
                        enrollment.course;


                    const progress =
                        enrollment.progress || 0;


                    const completed =
                        enrollment.completed;


                    message +=
                        `${index + 1}. <b>${course.name}</b>\n`;


                    message +=
                        `📊 Level: ${
                            course.level || "Beginner"
                        }\n`;


                    message +=
                        completed
                            ? `✅ Completed\n`
                            : `📈 Progress: ${progress}%\n`;


                    if (
                        enrollment.totalLessons
                    ) {

                        message +=
                            `📚 Lessons: ${
                                enrollment.completedLessons || 0
                            }/${
                                enrollment.totalLessons
                            }\n`;

                    }


                    message += `\n`;

                }
            );


            message +=
                `👇 Select a course to view its details.`;


            // ====================================================
            // COURSE BUTTONS
            // ====================================================

            const courseButtons =
                validEnrollments.map(
                    (enrollment) => {

                        const course =
                            enrollment.course;


                        return [

                            {
                                text:
                                    `📚 ${
                                        course.name
                                    }`,

                                callback_data:
                                    `my_course_${course._id}`,

                            },

                        ];

                    }
                );


            // ====================================================
            // BOTTOM BUTTONS
            // ====================================================

            courseButtons.push(

                [
                    {
                        text: "🌐 Explore More Courses",
                        url:
                            "https://blockhubglobal.xyz/courses",
                    },
                ],

                [
                    {
                        text: "⬅️ Back to Courses",
                        callback_data: "courses",
                    },
                ],

                [
                    {
                        text: "🏠 Back to Agent",
                        callback_data: "agent_home",
                    },
                ]

            );


            // ====================================================
            // SEND MY COURSES
            // ====================================================

            await ctx.reply(

                message,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard:
                            courseButtons,
                    },
                }

            );

        } catch (error) {

            console.error(
                "My courses action error:",
                error
            );


            await ctx.reply(
                "❌ Unable to load your courses right now. Please try again later."
            );

        }

    });


    // ============================================================
    // MY COURSE DETAILS
    // ============================================================

    bot.action(
        /^my_course_(.+)$/,
        async (ctx) => {

            try {

                await ctx.answerCbQuery();


                const courseId =
                    ctx.match[1];


                // Delete previous list
                try {

                    await ctx.deleteMessage();

                } catch (error) {

                    console.log(
                        "Could not delete previous message:",
                        error.message
                    );

                }


                // =================================================
                // GET TELEGRAM USER
                // =================================================

                const telegramId =
                    String(ctx.from.id);


                const user =
                    await User.findOne({
                        "telegram.id": telegramId,
                    });


                if (!user) {

                    return ctx.reply(
                        "❌ Your Telegram account is not connected to BlockHub."
                    );

                }


                // =================================================
                // GET ENROLLMENT
                // =================================================

                const enrollment =
                    await Enrollment.findOne({

                        user: user._id,

                        course: courseId,

                    })
                    .populate({
                        path: "course",
                        populate: {
                            path: "tutor",
                            populate: {
                                path: "user",
                                select:
                                    "fullName twitterHandle",
                            },
                        },
                    });


                if (
                    !enrollment ||
                    !enrollment.course
                ) {

                    return ctx.reply(

                        `❌ <b>Course Not Found</b>\n\n` +

                        `This course is not currently part of your enrolled courses.`,

                        {
                            parse_mode: "HTML",

                            reply_markup: {
                                inline_keyboard: [

                                    [
                                        {
                                            text: "📖 My Courses",
                                            callback_data:
                                                "my_courses",
                                        },
                                    ],

                                    [
                                        {
                                            text: "🏠 Back to Agent",
                                            callback_data:
                                                "agent_home",
                                        },
                                    ],

                                ],
                            },
                        }

                    );

                }


                const course =
                    enrollment.course;


                // =================================================
                // COURSE INFORMATION
                // =================================================

                const level =
                    course.level ||
                    "Beginner";


                const progress =
                    enrollment.progress || 0;


                const completedLessons =
                    enrollment.completedLessons || 0;


                const totalLessons =
                    enrollment.totalLessons ||
                    course.lessons?.length ||
                    0;


                const status =
                    enrollment.completed
                        ? "✅ Completed"
                        : `📈 ${progress}% complete`;


                let overview =
                    course.overview ||
                    "No course overview available.";


                // Remove HTML from overview
                overview =
                    overview
                        .replace(/<[^>]*>/g, "")
                        .trim();


                // Keep Telegram message short
                if (
                    overview.length > 500
                ) {

                    overview =
                        overview.substring(0, 500) +
                        "...";

                }


                // =================================================
                // COURSE DETAILS MESSAGE
                // =================================================

                let message =
                    `🎓 <b>${course.name}</b>\n\n`;


                message +=
                    `📊 <b>Level:</b> ${level}\n`;


                message +=
                    `📚 <b>Lessons:</b> ${
                        completedLessons
                    }/${totalLessons}\n`;


                message +=
                    `${status}\n\n`;


                message +=
                    `📝 <b>About this course</b>\n\n`;


                message +=
                    `${overview}\n\n`;


                if (
                    course.tag
                ) {

                    message +=
                        `🏷️ ${course.tag}\n\n`;

                }


                message +=
                    `🚀 Continue your learning journey with BlockHub.`;


                // =================================================
                // BUTTONS
                // =================================================

                await ctx.reply(

                    message,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text:
                                            enrollment.completed
                                                ? "🏆 View Certificate"
                                                : "▶️ Continue Learning",

                                        url:
                                            `https://blockhubglobal.xyz/courses/${course._id}`,
                                    },
                                ],

                                [
                                    {
                                        text: "🌐 Open Course",
                                        url:
                                            `https://blockhubglobal.xyz/courses/${course._id}`,
                                    },
                                ],

                                [
                                    {
                                        text: "📖 My Courses",
                                        callback_data:
                                            "my_courses",
                                    },
                                ],

                                [
                                    {
                                        text: "⬅️ Back to Courses",
                                        callback_data:
                                            "courses",
                                    },
                                ],

                                [
                                    {
                                        text: "🏠 Back to Agent",
                                        callback_data:
                                            "agent_home",
                                    },
                                ],

                            ],
                        },
                    }

                );

            } catch (error) {

                console.error(
                    "My course details error:",
                    error
                );


                await ctx.reply(
                    "❌ Unable to load this course right now."
                );

            }

        }
    );

};