const Course = require("../../../models/Course");

module.exports = (bot) => {

    // ============================================================
    // EXPLORE COURSES
    // ============================================================

    bot.action("explore_courses", async (ctx) => {

        try {

            await ctx.answerCbQuery();

            // Delete previous screen
            try {

                await ctx.deleteMessage();

            } catch (error) {

                console.log(
                    "Could not delete previous message:",
                    error.message
                );

            }


            // ====================================================
            // GET TOP 5 PUBLISHED COURSES
            // ====================================================

            const courses = await Course.find({

                isPublished: true,

                isDraft: false,

            })
                .select(
                    "name overview level pricing tag lessons"
                )
                .sort({
                    publishedAt: -1,
                })
                .limit(5);


            // ====================================================
            // NO COURSES
            // ====================================================

            if (courses.length === 0) {

                return ctx.reply(

                    `🎓 <b>EXPLORE COURSES</b>\n\n` +

                    `There are no published courses available right now.\n\n` +

                    `Check back soon — new learning opportunities are coming. 🚀`,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text: "🌐 Explore More Courses",
                                        url: "https://blockhubglobal.xyz/courses",
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
            // BUILD COURSE LIST
            // ====================================================

            let message =
                `🎓 <b>EXPLORE BLOCKHUB COURSES</b>\n\n`;

            message +=
                `Here are the latest courses available on BlockHub.\n\n`;


            courses.forEach((course, index) => {

                const price =
                    course.pricing?.type === "paid"
                        ? `${course.pricing.amount} ${course.pricing.currency}`
                        : "Free";


                const lessons =
                    course.lessons?.length || 0;


                message +=
                    `${index + 1}. <b>${course.name}</b>\n`;

                message +=
                    `📊 Level: ${course.level || "Beginner"}\n`;

                message +=
                    `💰 Price: ${price}\n`;

                message +=
                    `📚 Lessons: ${lessons}\n`;


                if (course.tag) {

                    message +=
                        `🏷️ ${course.tag}\n`;

                }


                if (course.overview) {

                    let overview =
                        course.overview
                            .replace(/<[^>]*>/g, "")
                            .trim();


                    if (overview.length > 100) {

                        overview =
                            overview.substring(0, 100) +
                            "...";

                    }


                    message +=
                        `${overview}\n`;

                }


                message += `\n`;

            });


            message +=
                `👇 <b>Select a course to view more details.</b>`;


            // ====================================================
            // COURSE BUTTONS
            // ====================================================

            const courseButtons =
                courses.map((course) => {

                    return [

                        {
                            text: `📚 ${course.name}`,

                            callback_data:
                                `course_${course._id}`,

                        },

                    ];

                });


            // ====================================================
            // BOTTOM BUTTONS
            // ====================================================

            courseButtons.push(

                [
                    {
                        text: "🌐 Explore More Courses",
                        url: "https://blockhubglobal.xyz//academy",
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
            // SEND COURSE LIST
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
                "Explore courses error:",
                error
            );

            await ctx.reply(
                "❌ Unable to load courses right now."
            );

        }

    });


    // ============================================================
    // COURSE DETAILS
    // ============================================================

    bot.action(/^course_(.+)$/, async (ctx) => {

        try {

            await ctx.answerCbQuery();

            const courseId =
                ctx.match[1];


            // ====================================================
            // FIND COURSE
            // ====================================================

            const course =
                await Course.findOne({

                    _id: courseId,

                    isPublished: true,

                    isDraft: false,

                })
                    .select(
                        "name overview level pricing tag lessons totalViews totalEnrollments"
                    );


            // ====================================================
            // COURSE NOT FOUND
            // ====================================================

            if (!course) {

                return ctx.reply(
                    "❌ This course is no longer available."
                );

            }


            // ====================================================
            // DELETE PREVIOUS COURSE LIST
            // ====================================================

            try {

                await ctx.deleteMessage();

            } catch (error) {

                console.log(
                    "Could not delete previous message:",
                    error.message
                );

            }


            // ====================================================
            // COURSE INFORMATION
            // ====================================================

            const price =
                course.pricing?.type === "paid"
                    ? `${course.pricing.amount} ${course.pricing.currency}`
                    : "Free";


            const lessons =
                course.lessons?.length || 0;


            let overview =
                course.overview
                    ? course.overview
                        .replace(/<[^>]*>/g, "")
                        .trim()
                    : "No course overview available.";


            // ====================================================
            // COURSE DETAILS MESSAGE
            // ====================================================

            let message =
                `🎓 <b>${course.name}</b>\n\n`;


            message +=
                `📊 <b>Level:</b> ${course.level || "Beginner"}\n`;


            message +=
                `💰 <b>Price:</b> ${price}\n`;


            message +=
                `📚 <b>Lessons:</b> ${lessons}\n`;


            if (course.tag) {

                message +=
                    `🏷️ <b>Category:</b> ${course.tag}\n`;

            }


            message += `\n`;


            message +=
                `📝 <b>About this course</b>\n\n`;


            message +=
                `${overview}\n\n`;


            message +=
                `🚀 Ready to start learning?`;


            // ====================================================
            // COURSE DETAILS BUTTONS
            // ====================================================

            await ctx.reply(

                message,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard: [

                            [
                                {
                                    text: "🌐 View & Enroll",
                                    url:
                                        `https://blockhubglobal.xyz/academy/courses/${course._id}`,
                                },
                            ],

                            [
                                {
                                    text: "⬅️ Back to Courses",
                                    callback_data: "explore_courses",
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

        } catch (error) {

            console.error(
                "Course details error:",
                error
            );


            await ctx.reply(
                "❌ Unable to load this course right now."
            );

        }

    });

};