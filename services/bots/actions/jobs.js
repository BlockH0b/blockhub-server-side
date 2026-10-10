const axios = require("axios");
require('dotenv').config();

module.exports = (bot) => {

    // ============================================================
    // JOBS
    // ============================================================

    bot.action("jobs", async (ctx) => {

        try {

            await ctx.answerCbQuery();


            // ====================================================
            // DELETE PREVIOUS SCREEN
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
            // FETCH JOBS
            // ====================================================

            const response = await axios.get(
                `${process.env.API_URL}/user_jobs/jobs?q=web3`
            );


            if (
                !response.data ||
                !response.data.success
            ) {

                throw new Error(
                    "Jobs API returned an unsuccessful response."
                );

            }


            const allJobs =
                response.data.data || [];


            // ====================================================
            // TOP 10 JOBS
            // ====================================================

            const jobs =
                allJobs.slice(0, 10);


            // ====================================================
            // NO JOBS
            // ====================================================

            if (jobs.length === 0) {

                return ctx.reply(

                    `💼 <b>BLOCKHUB JOBS</b>\n\n` +

                    `No Web3 jobs are available right now.\n\n` +

                    `Check back later for new opportunities. 🚀`,

                    {
                        parse_mode: "HTML",

                        reply_markup: {
                            inline_keyboard: [

                                [
                                    {
                                        text: "🌐 Explore More Jobs",
                                        url:
                                            "https://blockhubglobal.xyz/jobs",
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

            }


            // ====================================================
            // BUILD JOB LIST
            // ====================================================

            let message =
                `💼 <b>BLOCKHUB JOBS</b>\n\n`;

            message +=
                `🔥 Here are the latest Web3 opportunities available right now.\n\n`;


            jobs.forEach((job, index) => {

                const title =
                    job.title ||
                    "Untitled Position";


                const company =
                    job.company ||
                    job.companyName ||
                    "Company not specified";


                const location =
                    job.location ||
                    "Remote";


                message +=
                    `${index + 1}. <b>${title}</b>\n`;

                message +=
                    `🏢 ${company}\n`;

                message +=
                    `📍 ${location}\n\n`;

            });


            message +=
                `👇 Choose a job below to apply.`;


            // ====================================================
            // JOB BUTTONS
            // ====================================================

            const jobButtons =
                jobs.map((job, index) => {

                    const title =
                        job.title ||
                        "View Job";


                    const applyLink =
                        job.applyLink ||
                        job.applyUrl ||
                        job.url;


                    // --------------------------------------------
                    // If job has an application URL
                    // --------------------------------------------

                    if (applyLink) {

                        return [

                            {
                                text:
                                    `🚀 ${index + 1}. Apply — ${title}`,

                                url:
                                    applyLink,

                            },

                        ];

                    }


                    // --------------------------------------------
                    // Fallback if no apply URL exists
                    // --------------------------------------------

                    return [

                        {
                            text:
                                `💼 ${index + 1}. ${title}`,

                            callback_data:
                                `job_${index}`,

                        },

                    ];

                });


            // ====================================================
            // BOTTOM BUTTONS
            // ====================================================

            jobButtons.push(

                [
                    {
                        text: "🌐 Explore More Jobs",
                        url:
                            "https://blockhubglobal.xyz/jobs",
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
            // SEND JOB LIST
            // ====================================================

            await ctx.reply(

                message,

                {
                    parse_mode: "HTML",

                    reply_markup: {
                        inline_keyboard:
                            jobButtons,
                    },
                }

            );

        } catch (error) {

            console.error(
                "Jobs action error:",
                error.response?.data ||
                error.message ||
                error
            );


            await ctx.reply(
                "❌ Unable to load jobs right now. Please try again later."
            );

        }

    });

};