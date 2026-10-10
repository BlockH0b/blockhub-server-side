require("dotenv").config();
const path = require('path'); // add this at the top



// All emails now go through the shared email service, so EMAIL_TEST_MODE,
// EMAIL_DISABLED and the SMTP provider settings apply here too.
// (see services/email/config.js)
const { deliver } = require("../services/email/transport");

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
            subject: "One Time Password",
            html: `<p style="line-height: 1.5">
        Your OTP verification code is: <br /> <br />
        <font size="3px">${otp}</font> <br />
        Please note that this otp will be valid for 5 minutes
        Best regards,<br />
        The Backend Team.
        </p>
        </div>`,
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
            html: `
        <p>Hi ${name},</p>
        <p>Welcome to BlockHub! We’re excited to have you onboard.</p>
        <p>Your purchase was successful. Expect your access materials within the next 24 hours.</p>
        <p>If you have any questions, feel free to reply directly to this email.</p>
        <p>— The BlockHub Team</p>

        <p>To keep things seamless, we’re moving all paid users into one WhatsApp group. That way, you'll never miss an update, resource, or next step.</p>

        <p><strong>Tap here to join:</strong> <a href="${groupLink}">${groupLink}</a></p>

        <hr/>
        <p><strong>📘 Attached PDF:</strong> "BlockHub Done-For-You Guide"</p>
        <p>Please go through this guide before contacting support — it contains all setup steps and resource links.</p>
      `,
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
            html: `
             <p>Hey ${name || 'there'},</p>

<p>You’ve officially unlocked access to the BlockHub Portfolio Toolkit 🎉</p>
<p>To keep things seamless, we’re moving all paid users into one WhatsApp group. That way, you'll never miss an update, resource, or next step.</p>

<p><strong>Tap here to join:</strong> <a href="${groupLink}">${groupLink}</a></p>

<p>Welcome on board.<br />– BlockHub Team</p>         `
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
            html: `
        <p>Hi ${name || 'there'},</p>
        <p>We’re excited to share your BlockHub portfolio with you.</p>
        <p>You can <strong>edit your portfolio here</strong> using Canva:</p>
        <p><a href="${portfolioLink}" target="_blank" rel="noopener noreferrer">${portfolioLink}</a></p>
       <p>Also, a PDF is attached to this email. This PDF contains important information to help you start your Web3 journey through the app.</p>
  <p>If you have any questions, feel free to reply to this email.</p>
        <p>Best regards,<br/>BlockHub Team</p>
      `,
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
      ? `<ul>${courses.map(course => `<li>${course}</li>`).join('')}</ul>`
      : '<p>No specific courses selected.</p>';

    const info = await transport.sendMail({
      from: `BlockHub Academy <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Welcome to BlockHub Academy 🎉",
      html: `
        <p>Hi ${name || 'there'},</p>
        
        <p>Thank you for registering with <strong>BlockHub Academy</strong>! 🚀</p>
        
        <p>You’ve shown interest in the following courses/skills:</p>
        ${courseList}

        <p>We’re excited to announce that our official academy launch is on <strong>5th January</strong>! 🗓️</p>
        
        <p>Next steps: our team will review your details and get in touch soon with more resources and onboarding information.</p>
        
        <p>If you have any questions, feel free to reply directly to this email.</p>
        
        <p>Best regards,<br/>The BlockHub Academy Team</p>
      `,
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

      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0; padding:0; background:#f5f5f5; font-family:Arial, Helvetica, sans-serif;">

            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="margin:0; padding:30px 0; background:#f5f5f5;"
            >
              <tr>
                <td align="center">

                  <table
                    width="620"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="
                      width:100%;
                      max-width:620px;
                      background:#ffffff;
                      margin:0 auto;
                    "
                  >

                    <!-- IMAGE -->
                    <tr>
                      <td style="padding:0; margin:0; line-height:0; font-size:0;">
                        <img
                          src="https://res.cloudinary.com/dd7faellv/image/upload/v1788434434/photo_2026-09-03_12-19-22_tvehzz.jpg"
                          alt="BlockHub"
                          width="620"
                          style="
                            display:block;
                            width:100%;
                            max-width:620px;
                            height:auto;
                            margin:0;
                            padding:0;
                            border:0;
                          "
                        />
                      </td>
                    </tr>

                    <!-- CONTENT -->
                    <tr>
                      <td style="padding:35px 30px; color:#222222;">

                        <h2 style="margin:0 0 20px; font-size:24px;">
                          Welcome to BlockHub Cohort 1.0 🎉
                        </h2>

                        <p style="font-size:16px; line-height:1.7; margin:0 0 16px;">
                          Hi ${name || "there"},
                        </p>

                        <p style="font-size:16px; line-height:1.7; margin:0 0 16px;">
                          Congratulations! Your registration for
                          <strong>BlockHub Cohort 1.0</strong> has been successfully received.
                        </p>

                        <p style="font-size:16px; line-height:1.7; margin:0 0 16px;">
                          You selected:
                        </p>

                        <p style="
                          font-size:16px;
                          line-height:1.7;
                          margin:0 0 20px;
                          padding:14px 16px;
                          background:#f3f3f3;
                          border-radius:8px;
                        ">
                          <strong>Track:</strong> ${track || "Your selected track"}
                        </p>

                        <p style="font-size:16px; line-height:1.7; margin:0 0 16px;">
                          We’re excited to have you join us. More information about
                          the cohort, onboarding, classes, and next steps will be
                          communicated to you through the official BlockHub channels.
                        </p>

                        <p style="font-size:16px; line-height:1.7; margin:0 0 25px;">
                          Keep an eye on your email and stay connected with the
                          BlockHub community so you don't miss important updates.
                        </p>

                        <p style="font-size:16px; line-height:1.7; margin:0;">
                          Welcome to the cohort. 🚀
                        </p>

                        <p style="font-size:16px; line-height:1.7; margin:25px 0 0;">
                          Best regards,<br />
                          <strong>BlockHub Team</strong>
                        </p>

                      </td>
                    </tr>

                  </table>

                </td>
              </tr>
            </table>

          </body>
        </html>
      `,
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