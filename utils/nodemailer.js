require("dotenv").config();
const path = require('path'); // add this at the top



// All emails now go through the shared email service, so EMAIL_TEST_MODE,
// EMAIL_DISABLED and the SMTP provider settings apply here too.
// (see services/email/config.js)
const { deliver } = require("../services/email/transport");
const { layout, h1, p, small, eyebrow, button, details, codeBox, esc } = require("../services/email/layout");

const FRONTEND = (process.env.FRONTEND_URL || "https://blockhubglobal.xyz").replace(/\/$/, "");

const transport = {
    sendMail: async (mail) => {
        const result = await deliver(mail);
        return { response: result.delivered ? `sent to ${result.recipients.join(", ")}` : `not sent (${result.reason})` };
    },
};


const sendOTP = async (email, otp) => {
    try {
        const info = await transport.sendMail({

            from: `Backend Team <${process.env.MAIL_USER}>`,
            to: email,
            subject: "Your BlockHub verification code",
            text: `Your BlockHub verification code is ${otp}. It is valid for 5 minutes.`,
            html: layout(
                eyebrow("Verification") +
                h1("Your verification code") +
                p("Use this code to finish signing in. It's valid for <strong style=\"color:#0a0a0a\">5 minutes</strong>.") +
                codeBox(otp) +
                small("Didn't ask for this? You can ignore this email — nobody can sign in without the code."),
                { preheader: `Your code is ${otp}` }
            ),
        });

        console.log("Email sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error);
        return { msg: "Error sending email", error };
    }
};
// const path = require("path");

const sendSuccessMessage = async (email, name, groupLink) => {
    console.log(email, name, groupLink);

    try {
        const info = await transport.sendMail({
            from: `BlockHub Team <${process.env.MAIL_USER}>`,
            to: email,
            subject: "You're In! Welcome to BlockHub 🎉",
            text: `Hi ${name || "dear"},\n\nThanks for completing your purchase. We’ll follow up shortly with access details.\n\n— BlockHub Team`,
            html: layout(
                eyebrow("Purchase confirmed") +
                h1(`Welcome to BlockHub, ${esc(name || "there")}!`) +
                p("Your purchase was successful. Expect your access materials within the next 24 hours.") +
                p("To keep things seamless, we're moving all paid users into one WhatsApp group, so you never miss an update, resource or next step.") +
                (groupLink ? button("Join the WhatsApp group", groupLink) : "") +
                p('<strong style="color:#0a0a0a">📘 Attached:</strong> "BlockHub Done-For-You Guide". Please go through it before contacting support — it has all the setup steps and resource links.') +
                small("Questions? Just reply to this email.<br/>— The BlockHub Team"),
                { preheader: "Your purchase was successful." }
            ),
            attachments: [
                {
                    filename: "BlockHub-Done-For-You-Guide.pdf",
                    path: path.join(__dirname, "docs", "BlockHub-Done-For-You-Guide.pdf"),
                    contentType: "application/pdf",
                },
            ],
        });

        console.log("✅ Email sent:", info.response);
    } catch (error) {
        console.error("❌ Error sending email:", error);
        return { msg: "Error sending email", error };
    }
};

const sendWhatsappInvite = async (email, name, groupLink) => {

    console.log(email, name, groupLink);

    try {
        const info = await transport.sendMail({
            from: `BlockHub Team <${process.env.MAIL_USER}>`,
            to: email,
            subject: "You're Invited: Join the BlockHub Portfolio Community on WhatsApp",
            html: layout(
                eyebrow("Portfolio Toolkit") +
                h1(`Hey ${esc(name || "there")}, you're in 🎉`) +
                p("You've officially unlocked access to the BlockHub Portfolio Toolkit.") +
                p("To keep things seamless, we're moving all paid users into one WhatsApp group, so you never miss an update, resource or next step.") +
                (groupLink ? button("Join the WhatsApp group", groupLink) : "") +
                small("Welcome on board.<br/>— BlockHub Team"),
                { preheader: "Join the BlockHub Portfolio community on WhatsApp." }
            )
        });

        console.log("WhatsApp invite sent:", info.response);
    } catch (error) {
        console.error("Error sending WhatsApp invite:", error);
        return { msg: "Error sending invite", error };
    }
};


const sendPortfolioEmail = async (email, name, portfolioLink, portfolioPdfPath) => {
    try {
        const info = await transport.sendMail({
            from: `BlockHub Team <${process.env.MAIL_USER}>`,
            to: email,
            subject: "Your BlockHub Portfolio & Editable Link",
            html: layout(
                eyebrow("Your portfolio") +
                h1(`Hi ${esc(name || "there")}, your portfolio is ready`) +
                p("We're excited to share your BlockHub portfolio with you. You can edit it any time on Canva.") +
                (portfolioLink ? button("Edit my portfolio", portfolioLink) : "") +
                p("A PDF is attached with important information to help you start your Web3 journey through the app.") +
                small("Questions? Just reply to this email.<br/>— BlockHub Team"),
                { preheader: "Your BlockHub portfolio and editable link." }
            ),
            attachments: [{
                filename: path.basename(portfolioPdfPath),
                path: portfolioPdfPath,
                contentType: 'application/pdf',
            },],
        });

        console.log("Portfolio email sent:", info.response);
    } catch (error) {
        console.error("Error sending portfolio email:", error);
        return { msg: "Error sending portfolio email", error };
    }
};


// const sendAcademyThankYou = async (email, name) => {
//     try {
//         const info = await transport.sendMail({
//             from: `BlockHub Academy <${process.env.MAIL_USER}>`,
//             to: email,
//             subject: "Welcome to BlockHub Academy 🎉",
//             html: `
//         <p>Hi ${name || 'there'},</p>
        
//         <p>Thank you for registering with <strong>BlockHub Academy</strong>! 🚀</p>
        
//         <p>We’re excited to have you onboard and can’t wait to support your Web3 learning journey.</p>
        
//         <p>Next steps: our team will review your details and get in touch soon with more resources and onboarding information.</p>
        
//         <p>If you have any questions, feel free to reply directly to this email.</p>
        
//         <p>Best regards,<br/>The BlockHub Academy Team</p>
//       `,
//         })

//         console.log("Thank-you email sent:", info.response)
//     } catch (error) {
//         console.error("Error sending thank-you email:", error)
//         return { msg: "Error sending thank-you email", error }
//     }
// }


const sendAcademyThankYou = async (email, name, courses = []) => {
  try {
    const courseList = courses.length
      ? details(courses.map((course, index) => [`Interest ${index + 1}`, course]))
      : p("No specific courses selected.");

    const info = await transport.sendMail({
      from: `BlockHub Academy <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Welcome to BlockHub Academy 🎉",
      html: layout(
        eyebrow("BlockHub Academy") +
        h1(`Thanks for registering, ${esc(name || "there")}! 🚀`) +
        p("We're excited to have you and can't wait to support your Web3 learning journey. You've shown interest in:") +
        courseList +
        p('Our official academy launch is on <strong style="color:#0a0a0a">5th January</strong>. Our team will review your details and get in touch soon with resources and onboarding information.') +
        button("Explore BlockHub Academy", `${FRONTEND}/academy`) +
        small("Questions? Just reply to this email.<br/>— The BlockHub Academy Team"),
        { preheader: "You're registered for BlockHub Academy." }
      ),
    });

    console.log("Thank-you email sent:", info.response);
  } catch (error) {
    console.error("Error sending thank-you email:", error);
    return { msg: "Error sending thank-you email", error };
  }
};


const sendCohortWelcomeEmail = async (email, name, track) => {
  try {
    const info = await transport.sendMail({
      from: `BlockHub Team <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Welcome to BlockHub Cohort 1.0 🎉",
      text: `Hi ${name || "there"}, your registration for BlockHub Cohort 1.0 (${track || "your track"}) has been received. Sign in: ${FRONTEND}/cohort/login`,

      html: layout(
        eyebrow("Cohort 1.0") +
        h1(`Welcome to the cohort, ${esc(name || "there")} 🎉`) +
        p('Congratulations! Your registration for <strong style="color:#0a0a0a">BlockHub Cohort 1.0</strong> has been received.') +
        details([["Your track", track || "Your selected track"]]) +
        p("We're excited to have you. Classes, onboarding and next steps will show up on your cohort dashboard, and we'll email you before every class.") +
        button("Open my cohort dashboard", `${FRONTEND}/cohort/login`) +
        small("Stay connected with the BlockHub community so you don't miss important updates.<br/>— BlockHub Team"),
        {
          preheader: "Your BlockHub Cohort 1.0 registration is confirmed.",
          // Cohort artwork at the top of the email (remove this line to hide it)
          banner: "https://res.cloudinary.com/dd7faellv/image/upload/v1788434434/photo_2026-09-03_12-19-22_tvehzz.jpg",
        }
      ),
    });

    console.log("✅ Cohort welcome email sent:", info.response);

    return {
      success: true,
      message: "Cohort welcome email sent",
    };
  } catch (error) {
    console.error("❌ Error sending cohort welcome email:", error);

    return {
      success: false,
      message: "Error sending cohort welcome email",
      error,
    };
  }
};



module.exports = { sendOTP, sendCohortWelcomeEmail, sendAcademyThankYou, sendSuccessMessage, sendWhatsappInvite, sendPortfolioEmail }