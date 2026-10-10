/*
 * ============================================================
 * All BlockHub email templates.
 * Each template: (data, ctx) => { subject, preheader, html, text }
 *   ctx = { frontendUrl, communityLink, name }
 * ============================================================
 */

const { h1, p, small, eyebrow, button, details, quote, itemList, linkRow, esc, textToHtml } = require("../layout");

const TZ = process.env.COHORT_TIMEZONE || "Africa/Lagos";

function fmtDate(date) {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

function fmtTime(date) {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })} (WAT)`;
}

function fmtMoney(amount, currency = "NGN") {
    const value = Number(amount) || 0;
    if (currency === "NGN") return `₦${value.toLocaleString("en-NG")}`;
    if (currency === "FREE") return "Free";
    return `${value.toLocaleString("en-US")} ${currency}`;
}

function meetingDuration(minutes) {
    const m = Number(minutes) || 0;
    if (!m) return "";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} hr ${r} min` : `${h} hr`;
}

const first = (name) => (String(name || "").trim().split(/\s+/)[0] || "there");

const T = {
    /* ======================================================
       ACCOUNT
    ====================================================== */

    verify_email: ({ name, url }) => ({
        subject: "Confirm your email for BlockHub",
        preheader: "One click to confirm your email address.",
        html:
            eyebrow("Confirm email") +
            h1(`Hi ${first(name)}, confirm your email`) +
            p("Tap the button below to confirm this is your email address. You'll then get class reminders, receipts and updates from BlockHub.") +
            button("Confirm my email", url) +
            small("This link expires in 24 hours. If you didn't ask for this, you can ignore this email."),
        text: `Confirm your BlockHub email: ${url}`,
    }),

    welcome: ({ name }, ctx) => ({
        subject: "Welcome to BlockHub 👋",
        preheader: "Jobs, GrindFi campaigns, Academy and Cohort — all in one place.",
        html:
            eyebrow("Welcome") +
            h1(`Welcome to BlockHub, ${first(name)}!`) +
            p("You're in. Here's what you can do on BlockHub:") +
            itemList([
                { title: "Web3 Jobs", subtitle: "Find remote roles and gigs in Web3." },
                { title: "GrindFi", subtitle: "Join campaigns, complete tasks, earn rewards." },
                { title: "Academy", subtitle: "Learn with courses from Web3 tutors." },
                { title: "Marketplace", subtitle: "Buy and sell digital products." },
            ]) +
            button("Explore BlockHub", ctx.frontendUrl) +
            (ctx.communityLink ? small(`Join the community: <a href="${esc(ctx.communityLink)}" style="color:#48FF75">${esc(ctx.communityLink)}</a>`) : ""),
        text: `Welcome to BlockHub! ${ctx.frontendUrl}`,
    }),

    /* ======================================================
       COHORT
    ====================================================== */

    cohort_login_link: ({ name, url }) => ({
        subject: "Your BlockHub Cohort login link",
        preheader: "Tap to open your cohort dashboard.",
        html:
            eyebrow("Cohort access") +
            h1(`Hi ${first(name)}, here's your login link`) +
            p("Use the button below to open your BlockHub Cohort dashboard. The link works once and expires in 7 days.") +
            button("Open my dashboard", url) +
            small("Didn't request this? You can ignore this email — nobody can log in without this link."),
        text: `Open your BlockHub Cohort dashboard: ${url}`,
    }),

    announcement: ({ name, tutorName, track, title, message, type }, ctx) => ({
        subject: `${type === "important" ? "📌 " : ""}${title} — ${track}`,
        preheader: String(message || "").slice(0, 110),
        html:
            eyebrow(`${track} · Announcement`) +
            h1(title) +
            p(`Hi ${esc(first(name))}, ${esc(tutorName || "your tutor")} posted a new announcement:`) +
            quote(textToHtml(message), type === "important" ? "#f59e0b" : "#48FF75") +
            button("Open my dashboard", `${ctx.frontendUrl}/cohort/my-dashboard`),
        text: `${title}\n\n${message}\n\n${ctx.frontendUrl}/cohort/my-dashboard`,
    }),

    class_scheduled: ({ name, track, cls }, ctx) => ({
        subject: `New class: ${cls.title} — ${fmtDate(cls.startsAt)}`,
        preheader: `${fmtDate(cls.startsAt)} at ${fmtTime(cls.startsAt)}`,
        html:
            eyebrow(`${track} · New class`) +
            h1(cls.title) +
            p(`Hi ${esc(first(name))}, a new class has been added to your schedule.`) +
            details([
                ["Class", cls.classNumber ? `Class ${cls.classNumber}` : ""],
                ["Date", fmtDate(cls.startsAt)],
                ["Time", fmtTime(cls.startsAt)],
                ["Duration", cls.duration],
            ]) +
            (cls.description ? p(esc(cls.description)) : "") +
            button("View my classes", `${ctx.frontendUrl}/cohort/my-dashboard`) +
            small("We'll remind you 1 hour before it starts."),
        text: `New class: ${cls.title} — ${fmtDate(cls.startsAt)} ${fmtTime(cls.startsAt)}`,
    }),

    class_updated: ({ name, track, cls, changes }, ctx) => ({
        subject: `Class time changed: ${cls.title}`,
        preheader: `Now ${fmtDate(cls.startsAt)} at ${fmtTime(cls.startsAt)}`,
        html:
            eyebrow(`${track} · Schedule change`) +
            h1(`${cls.title} has moved`) +
            p(`Hi ${esc(first(name))}, the time for this class has changed. Here are the new details:`) +
            details([
                ["New date", fmtDate(cls.startsAt)],
                ["New time", fmtTime(cls.startsAt)],
                ["Was", changes?.previousStartsAt ? `${fmtDate(changes.previousStartsAt)} ${fmtTime(changes.previousStartsAt)}` : ""],
            ]) +
            button("View my classes", `${ctx.frontendUrl}/cohort/my-dashboard`),
        text: `${cls.title} now: ${fmtDate(cls.startsAt)} ${fmtTime(cls.startsAt)}`,
    }),

    class_cancelled: ({ name, track, cls }, ctx) => ({
        subject: `Class cancelled: ${cls.title}`,
        preheader: `The class on ${fmtDate(cls.startsAt)} won't hold.`,
        html:
            eyebrow(`${track} · Cancelled`) +
            h1(`${cls.title} is cancelled`) +
            p(`Hi ${esc(first(name))}, the class below has been cancelled by your tutor. Keep an eye on your dashboard for a new date.`) +
            details([
                ["Date", fmtDate(cls.startsAt)],
                ["Time", fmtTime(cls.startsAt)],
            ]) +
            button("Open my dashboard", `${ctx.frontendUrl}/cohort/my-dashboard`),
        text: `Cancelled: ${cls.title} (${fmtDate(cls.startsAt)})`,
    }),

    class_reminder: ({ name, track, cls, joinUrl }, ctx) => ({
        subject: `⏰ Starts in 1 hour: ${cls.title}`,
        preheader: `Today at ${fmtTime(cls.startsAt)}`,
        html:
            eyebrow(`${track} · Reminder`) +
            h1(`Your class starts in 1 hour`) +
            p(`Hi ${esc(first(name))}, <strong style="color:#fff">${esc(cls.title)}</strong> starts at ${esc(fmtTime(cls.startsAt))}.`) +
            details([
                ["Date", fmtDate(cls.startsAt)],
                ["Time", fmtTime(cls.startsAt)],
                ["Duration", cls.duration],
            ]) +
            button(joinUrl ? "Open the class room" : "Open my dashboard", joinUrl || `${ctx.frontendUrl}/cohort/my-dashboard`) +
            small("Test your camera and mic a few minutes early on the join screen."),
        text: `Starts in 1 hour: ${cls.title} at ${fmtTime(cls.startsAt)}. ${joinUrl || ctx.frontendUrl}`,
    }),

    class_live: ({ name, track, title, tutorName, joinUrl }) => ({
        subject: `🔴 Live now: ${title}`,
        preheader: `${tutorName || "Your tutor"} just started the class.`,
        html:
            eyebrow(`${track} · Live now`) +
            h1(`${title} is live`) +
            p(`Hi ${esc(first(name))}, ${esc(tutorName || "your tutor")} has started the class. Jump in!`) +
            button("Join the class", joinUrl),
        text: `Live now: ${title}. Join: ${joinUrl}`,
    }),

    missed_class: ({ name, track, title, endedAt }, ctx) => ({
        subject: `We missed you in "${title}"`,
        preheader: "Catch up before the next class.",
        html:
            eyebrow(`${track} · Catch up`) +
            h1(`We missed you today`) +
            p(`Hi ${esc(first(name))}, you weren't in <strong style="color:#fff">${esc(title)}</strong> (${esc(fmtDate(endedAt))}). No stress — check your dashboard for the curriculum and the next class so you don't fall behind.`) +
            button("See what's next", `${ctx.frontendUrl}/cohort/my-dashboard`),
        text: `You missed ${title}. Catch up: ${ctx.frontendUrl}/cohort/my-dashboard`,
    }),

    tutor_assigned: ({ name, track, tutorCode }, ctx) => ({
        subject: `You're now a BlockHub Cohort tutor — ${track}`,
        preheader: "Your tutor dashboard is ready.",
        html:
            eyebrow("Cohort tutor") +
            h1(`Welcome aboard, ${first(name)}!`) +
            p(`You've been made a tutor for the <strong style="color:#fff">${esc(track)}</strong> track.`) +
            details([
                ["Track", track],
                ["Tutor code", tutorCode],
            ]) +
            p("From your dashboard you can schedule classes, go live with BlockHub Live, post announcements and see your students.") +
            button("Open tutor dashboard", `${ctx.frontendUrl}/cohort/tutor/dashboard`),
        text: `You're now a tutor for ${track}. ${ctx.frontendUrl}/cohort/tutor/dashboard`,
    }),

    track_switched: ({ name, track }, ctx) => ({
        subject: `You're now in the ${track} track`,
        preheader: "Your dashboard has been updated.",
        html:
            eyebrow("Track updated") +
            h1(`Welcome to ${track}`) +
            p(`Hi ${esc(first(name))}, your cohort track has been switched. Your classes, tutor and announcements now come from <strong style="color:#fff">${esc(track)}</strong>.`) +
            button("Open my dashboard", `${ctx.frontendUrl}/cohort/my-dashboard`),
        text: `Your track is now ${track}.`,
    }),

    weekly_digest: ({ name, track, classes, announcements }, ctx) => ({
        subject: `Your week in ${track}`,
        preheader: `${classes.length} class${classes.length === 1 ? "" : "es"} this week`,
        html:
            eyebrow(`${track} · Weekly`) +
            h1(`Your week ahead, ${first(name)}`) +
            (classes.length
                ? p("<strong style='color:#fff'>Classes this week</strong>") +
                itemList(classes.map((c) => ({ title: c.title, subtitle: `${fmtDate(c.startsAt)} · ${fmtTime(c.startsAt)}` })))
                : p("No classes are scheduled this week yet.")) +
            (announcements.length
                ? p("<strong style='color:#fff'>New announcements</strong>") +
                itemList(announcements.map((a) => ({ title: a.title, subtitle: String(a.message || "").slice(0, 120) })))
                : "") +
            button("Open my dashboard", `${ctx.frontendUrl}/cohort/my-dashboard`),
        text: `Your week in ${track}: ${classes.map((c) => c.title).join(", ")}`,
    }),

    /* ======================================================
       GRINDFI CAMPAIGNS
    ====================================================== */

    campaign_joined: ({ name, campaign, totalTasks }, ctx) => ({
        subject: `You joined "${campaign.title}" 🎯`,
        preheader: `Complete ${totalTasks || "the"} tasks before ${fmtDate(campaign.endDate)}.`,
        html:
            eyebrow("GrindFi · Joined") +
            h1(`You're in, ${first(name)}!`) +
            p(`You've joined <strong style="color:#fff">${esc(campaign.title)}</strong>. Complete the tasks to earn your reward.`) +
            details([
                ["Tasks", totalTasks],
                ["Reward", campaign.rewardText],
                ["Ends", `${fmtDate(campaign.endDate)} ${fmtTime(campaign.endDate)}`],
            ]) +
            button("Start the tasks", `${ctx.frontendUrl}/grindfi/${campaign.slug}`),
        text: `You joined ${campaign.title}. ${ctx.frontendUrl}/grindfi/${campaign.slug}`,
    }),

    campaign_task_submitted: ({ name, campaign, taskTitle }, ctx) => ({
        subject: `Submission received — ${campaign.title}`,
        preheader: "We'll let you know once it's reviewed.",
        html:
            eyebrow("GrindFi · Submitted") +
            h1("We got your submission ✅") +
            p(`Hi ${esc(first(name))}, your submission for <strong style="color:#fff">${esc(taskTitle || "a task")}</strong> in ${esc(campaign.title)} has been received.`) +
            button("View campaign", `${ctx.frontendUrl}/grindfi/${campaign.slug}`),
        text: `Submission received for ${campaign.title}.`,
    }),

    campaign_live: ({ name, campaign }, ctx) => ({
        subject: `New on GrindFi: ${campaign.title}`,
        preheader: campaign.rewardText ? `Reward: ${campaign.rewardText}` : "A new campaign just went live.",
        html:
            eyebrow("GrindFi · New campaign") +
            h1(campaign.title) +
            p(`Hi ${esc(first(name))}, a new campaign just went live on GrindFi.`) +
            (campaign.description ? quote(esc(String(campaign.description).slice(0, 400))) : "") +
            details([
                ["Reward", campaign.rewardText],
                ["Ends", fmtDate(campaign.endDate)],
            ]) +
            button("Join the campaign", `${ctx.frontendUrl}/grindfi/${campaign.slug}`),
        text: `New campaign: ${campaign.title}. ${ctx.frontendUrl}/grindfi/${campaign.slug}`,
    }),

    campaign_ending_soon: ({ name, campaign, remainingTasks }, ctx) => ({
        subject: `⏳ 24 hours left: ${campaign.title}`,
        preheader: `${remainingTasks} task${remainingTasks === 1 ? "" : "s"} left to complete.`,
        html:
            eyebrow("GrindFi · Ending soon") +
            h1("Less than 24 hours left") +
            p(`Hi ${esc(first(name))}, <strong style="color:#fff">${esc(campaign.title)}</strong> ends ${esc(fmtDate(campaign.endDate))} at ${esc(fmtTime(campaign.endDate))}. You still have <strong style="color:#48FF75">${remainingTasks}</strong> task${remainingTasks === 1 ? "" : "s"} to finish.`) +
            button("Finish my tasks", `${ctx.frontendUrl}/grindfi/${campaign.slug}`),
        text: `${campaign.title} ends in 24h. ${remainingTasks} tasks left.`,
    }),

    campaign_ended: ({ name, campaign, completedTasks, totalTasks }, ctx) => ({
        subject: `${campaign.title} has ended`,
        preheader: `You completed ${completedTasks}/${totalTasks} tasks.`,
        html:
            eyebrow("GrindFi · Ended") +
            h1("Campaign ended") +
            p(`Hi ${esc(first(name))}, <strong style="color:#fff">${esc(campaign.title)}</strong> has ended. Thanks for taking part!`) +
            details([
                ["Your tasks", `${completedTasks} of ${totalTasks}`],
                ["Reward", campaign.rewardText],
            ]) +
            p("Rewards are shared by the project team after reviewing submissions. Keep an eye on your GrindFi dashboard.") +
            button("See more campaigns", `${ctx.frontendUrl}/grindfi`),
        text: `${campaign.title} has ended.`,
    }),

    campaign_owner_daily: ({ name, campaigns }, ctx) => ({
        subject: `Your campaigns today: +${campaigns.reduce((s, c) => s + c.newParticipants, 0)} participants`,
        preheader: "Daily GrindFi summary.",
        html:
            eyebrow("GrindFi · Daily summary") +
            h1(`Here's your day, ${first(name)}`) +
            itemList(
                campaigns.map((c) => ({
                    title: c.title,
                    subtitle: `+${c.newParticipants} new participants · +${c.newSubmissions} submissions · ${c.totalParticipants} total`,
                }))
            ) +
            button("Open my campaigns", `${ctx.frontendUrl}/dashboard/my-campaigns`),
        text: campaigns.map((c) => `${c.title}: +${c.newParticipants}`).join("\n"),
    }),

    /* ======================================================
       ACADEMY
    ====================================================== */

    course_enrolled: ({ name, course }, ctx) => ({
        subject: `You're enrolled: ${course.name}`,
        preheader: "Start your first lesson now.",
        html:
            eyebrow("Academy · Enrolled") +
            h1(`Let's learn, ${first(name)}!`) +
            p(`You're now enrolled in <strong style="color:#fff">${esc(course.name)}</strong>.`) +
            details([
                ["Lessons", course.lessonCount],
                ["Level", course.level],
            ]) +
            button("Start learning", `${ctx.frontendUrl}/dashboard/course/${course.id}`),
        text: `You're enrolled in ${course.name}.`,
    }),

    course_completed: ({ name, course, certificateUrl }, ctx) => ({
        subject: `🎓 You completed ${course.name}!`,
        preheader: "Your certificate is ready.",
        html:
            eyebrow("Academy · Completed") +
            h1(`Congratulations, ${first(name)}!`) +
            p(`You've completed <strong style="color:#fff">${esc(course.name)}</strong>. Your certificate is ready to download and share.`) +
            button("Download my certificate", certificateUrl || `${ctx.frontendUrl}/dashboard`) +
            small("Share it on X or LinkedIn and tag @BlockHub — we love to see it."),
        text: `You completed ${course.name}. Certificate: ${certificateUrl}`,
    }),

    course_submitted_admin: ({ tutorName, courseTitle, description }, ctx) => ({
        subject: `New course for review: ${courseTitle}`,
        preheader: `${tutorName} submitted a course.`,
        html:
            eyebrow("Admin · Review needed") +
            h1("A course is waiting for review") +
            details([
                ["Course", courseTitle],
                ["Tutor", tutorName],
            ]) +
            (description ? quote(textToHtml(String(description).slice(0, 600))) : "") +
            button("Review courses", `${ctx.frontendUrl}/dashboard/submitted-courses`),
        text: `${tutorName} submitted ${courseTitle} for review.`,
    }),

    course_review_result: ({ name, courseTitle, status, reason }, ctx) => {
        const approved = status === "approved";
        return {
            subject: approved ? `✅ Approved: ${courseTitle}` : `Changes needed: ${courseTitle}`,
            preheader: approved ? "You can now build and publish it." : "See the reviewer's note.",
            html:
                eyebrow(`Academy · ${approved ? "Approved" : "Not approved"}`) +
                h1(approved ? "Your course was approved 🎉" : "Your course needs changes") +
                p(`Hi ${esc(first(name))}, your submission <strong style="color:#fff">${esc(courseTitle)}</strong> was ${approved ? "approved" : "not approved yet"}.`) +
                (reason ? quote(textToHtml(reason), approved ? "#48FF75" : "#f59e0b") : "") +
                button("Open course management", `${ctx.frontendUrl}/dashboard/course-management`),
            text: `${courseTitle}: ${status}. ${reason || ""}`,
        };
    },

    course_nudge: ({ name, course, progress }, ctx) => ({
        subject: `Pick up where you left off: ${course.name}`,
        preheader: `You're ${progress}% through.`,
        html:
            eyebrow("Academy · Keep going") +
            h1(`You're ${progress}% there`) +
            p(`Hi ${esc(first(name))}, it's been a week since you last opened <strong style="color:#fff">${esc(course.name)}</strong>. A few minutes today keeps the momentum going.`) +
            button("Continue the course", `${ctx.frontendUrl}/dashboard/course/${course.id}`),
        text: `Continue ${course.name}: ${ctx.frontendUrl}/dashboard/course/${course.id}`,
    }),

    /* ======================================================
       PAYMENTS & MARKETPLACE
    ====================================================== */

    course_receipt: ({ name, course, amount, currency, reference, paidAt }, ctx) => ({
        subject: `Receipt: ${course.name}`,
        preheader: `Payment of ${fmtMoney(amount, currency)} confirmed.`,
        html:
            eyebrow("Payment confirmed") +
            h1("Thanks for your purchase!") +
            p(`Hi ${esc(first(name))}, your payment was successful and the course is now in your library.`) +
            details([
                ["Course", course.name],
                ["Amount", fmtMoney(amount, currency)],
                ["Reference", reference],
                ["Date", `${fmtDate(paidAt)} ${fmtTime(paidAt)}`],
            ]) +
            button("Start learning", `${ctx.frontendUrl}/dashboard/course/${course.id}`),
        text: `Receipt — ${course.name} — ${fmtMoney(amount, currency)} — ref ${reference}`,
    }),

    product_receipt: ({ name, product, amount, currency, reference, paidAt }, ctx) => ({
        subject: `Receipt: ${product.title}`,
        preheader: currency === "FREE" ? "Your download is ready." : `Payment of ${fmtMoney(amount, currency)} confirmed.`,
        html:
            eyebrow(currency === "FREE" ? "Claimed" : "Payment confirmed") +
            h1("Your product is ready 🎉") +
            p(`Hi ${esc(first(name))}, you can access <strong style="color:#fff">${esc(product.title)}</strong> any time from your purchases.`) +
            details([
                ["Product", product.title],
                ["Amount", fmtMoney(amount, currency)],
                ["Reference", reference],
                ["Date", `${fmtDate(paidAt)} ${fmtTime(paidAt)}`],
            ]) +
            button("Go to my purchases", `${ctx.frontendUrl}/dashboard/market/my-purchase`),
        text: `Receipt — ${product.title} — ${fmtMoney(amount, currency)}`,
    }),

    new_sale: ({ name, itemName, itemKind, amount, earning, currency }, ctx) => ({
        subject: `💸 You made a sale: ${itemName}`,
        preheader: `You earned ${fmtMoney(earning, currency)}.`,
        html:
            eyebrow("New sale") +
            h1(`Nice one, ${first(name)}!`) +
            p(`Someone just bought your ${esc(itemKind)} <strong style="color:#fff">${esc(itemName)}</strong>.`) +
            details([
                ["Sale price", fmtMoney(amount, currency)],
                ["Your earning", fmtMoney(earning, currency)],
            ]) +
            button("View my sales", itemKind === "course" ? `${ctx.frontendUrl}/dashboard/course-management` : `${ctx.frontendUrl}/dashboard/market/my-listing`),
        text: `You sold ${itemName} for ${fmtMoney(amount, currency)}.`,
    }),

    payment_failed: ({ name, itemName, retryUrl }) => ({
        subject: `Payment didn't go through: ${itemName}`,
        preheader: "No money was taken. You can try again.",
        html:
            eyebrow("Payment failed") +
            h1("Your payment didn't go through") +
            p(`Hi ${esc(first(name))}, we couldn't complete your payment for <strong style="color:#fff">${esc(itemName)}</strong>. If you were debited, it will be reversed by your bank — or reply to this email and we'll help.`) +
            button("Try again", retryUrl),
        text: `Payment for ${itemName} failed. Try again: ${retryUrl}`,
    }),

    product_published: ({ name, product }, ctx) => ({
        subject: `Your product is live: ${product.title}`,
        preheader: "Share the link and start selling.",
        html:
            eyebrow("Marketplace · Published") +
            h1("Your product is live 🚀") +
            p(`Hi ${esc(first(name))}, <strong style="color:#fff">${esc(product.title)}</strong> is now on the BlockHub Marketplace.`) +
            details([["Link", `${ctx.frontendUrl}/market/${product.slug}`]]) +
            button("View product", `${ctx.frontendUrl}/market/${product.slug}`),
        text: `Your product is live: ${ctx.frontendUrl}/market/${product.slug}`,
    }),

    /* ======================================================
       REFERRALS & WAITLIST
    ====================================================== */

    referral_used: ({ name, referredName, totalReferrals }, ctx) => ({
        subject: `🎉 ${referredName || "Someone"} joined with your referral code`,
        preheader: `You now have ${totalReferrals} referral${totalReferrals === 1 ? "" : "s"}.`,
        html:
            eyebrow("Referrals") +
            h1("Your referral worked!") +
            p(`Hi ${esc(first(name))}, <strong style="color:#fff">${esc(referredName || "a new member")}</strong> just signed up with your code.`) +
            details([["Total referrals", totalReferrals]]) +
            button("View my referrals", `${ctx.frontendUrl}/referral-dashboard`),
        text: `${referredName} used your referral code. Total: ${totalReferrals}`,
    }),

    waitlist_joined: (_data, ctx) => ({
        subject: "You're on the BlockHub waitlist ✅",
        preheader: "We'll let you know as soon as it opens.",
        html:
            eyebrow("Waitlist") +
            h1("You're on the list!") +
            p("Thanks for joining the waitlist. We'll email you as soon as it opens.") +
            button("Visit BlockHub", ctx.frontendUrl),
        text: "You're on the BlockHub waitlist.",
    }),

    /* ======================================================
       BLOCKHUB MEETINGS (general calls hosted by admins)
       data.meeting = { title, description, startsAt, endsAt,
                        durationMinutes, hostName, url, code }
       data.links   = { google, outlook, ics }
    ====================================================== */

    meeting_invite: ({ name, meeting, acceptUrl, declineUrl, message, invitedBy }) => ({
        subject: `You're invited: ${meeting.title} — ${fmtDate(meeting.startsAt)}`,
        preheader: `${fmtDate(meeting.startsAt)} at ${fmtTime(meeting.startsAt)} on BlockHub Live`,
        html:
            eyebrow("BlockHub Meeting · Invitation") +
            h1(meeting.title) +
            p(`Hi ${esc(first(name))}, ${esc(invitedBy || "the BlockHub team")} invited you to a call on BlockHub.`) +
            (message ? quote(textToHtml(message)) : "") +
            details([
                ["Date", fmtDate(meeting.startsAt)],
                ["Time", fmtTime(meeting.startsAt)],
                ["Duration", meetingDuration(meeting.durationMinutes)],
                ["Host", meeting.hostName],
            ]) +
            (meeting.description ? p(textToHtml(String(meeting.description).slice(0, 800))) : "") +
            button("Accept invite", acceptUrl) +
            small(`Accepting books your spot and adds the meeting to your calendar. Can't make it? <a href="${esc(declineUrl)}" style="color:#48FF75">Decline</a>.`),
        text: `You're invited to ${meeting.title} on ${fmtDate(meeting.startsAt)} at ${fmtTime(meeting.startsAt)}. Accept: ${acceptUrl}`,
    }),

    meeting_rsvp_confirmed: ({ name, meeting, links, joinUrl, declineUrl }) => ({
        subject: `✅ You're booked: ${meeting.title} — ${fmtDate(meeting.startsAt)}`,
        preheader: `${fmtDate(meeting.startsAt)} at ${fmtTime(meeting.startsAt)}. It's in your calendar.`,
        html:
            eyebrow("BlockHub Meeting · Confirmed") +
            h1(`You're in, ${first(name)}!`) +
            p(`Your spot for <strong style="color:#fff">${esc(meeting.title)}</strong> is booked. We've attached a calendar invite, so it should show up in your calendar automatically.`) +
            details([
                ["Date", fmtDate(meeting.startsAt)],
                ["Time", fmtTime(meeting.startsAt)],
                ["Duration", meetingDuration(meeting.durationMinutes)],
                ["Host", meeting.hostName],
                ["Meeting code", meeting.code],
            ]) +
            button("Open the meeting page", joinUrl) +
            small("Not in your calendar? Add it here:") +
            linkRow([
                ["Google Calendar", links?.google],
                ["Outlook", links?.outlook],
                ["Apple / other (.ics)", links?.ics],
            ]) +
            small(`We'll remind you 1 hour before it starts. Can't make it anymore? <a href="${esc(declineUrl)}" style="color:#48FF75">Cancel my spot</a>.`),
        text: `You're booked for ${meeting.title} on ${fmtDate(meeting.startsAt)} at ${fmtTime(meeting.startsAt)}. Join: ${joinUrl}`,
    }),

    meeting_rsvp_declined: ({ name, meeting, joinUrl }) => ({
        subject: `Spot cancelled: ${meeting.title}`,
        preheader: "We've removed it from your calendar.",
        html:
            eyebrow("BlockHub Meeting") +
            h1("Your spot is cancelled") +
            p(`Hi ${esc(first(name))}, you won't be attending <strong style="color:#fff">${esc(meeting.title)}</strong> (${esc(fmtDate(meeting.startsAt))}). We've removed it from your calendar.`) +
            button("Changed your mind? Book again", joinUrl),
        text: `Your spot for ${meeting.title} is cancelled. Book again: ${joinUrl}`,
    }),

    meeting_updated: ({ name, meeting, previousStartsAt, links, joinUrl }) => ({
        subject: `Updated: ${meeting.title} — now ${fmtDate(meeting.startsAt)}`,
        preheader: `Now ${fmtDate(meeting.startsAt)} at ${fmtTime(meeting.startsAt)}. Your calendar is updated.`,
        html:
            eyebrow("BlockHub Meeting · Updated") +
            h1(`${meeting.title} has changed`) +
            p(`Hi ${esc(first(name))}, the details for this meeting changed. Your calendar invite has been updated.`) +
            details([
                ["Date", fmtDate(meeting.startsAt)],
                ["Time", fmtTime(meeting.startsAt)],
                ["Duration", meetingDuration(meeting.durationMinutes)],
                ["Was", previousStartsAt ? `${fmtDate(previousStartsAt)} ${fmtTime(previousStartsAt)}` : ""],
            ]) +
            button("Open the meeting page", joinUrl) +
            linkRow([
                ["Google Calendar", links?.google],
                ["Outlook", links?.outlook],
                ["Apple / other (.ics)", links?.ics],
            ]),
        text: `${meeting.title} is now ${fmtDate(meeting.startsAt)} ${fmtTime(meeting.startsAt)}. ${joinUrl}`,
    }),

    meeting_cancelled: ({ name, meeting, reason }, ctx) => ({
        subject: `Cancelled: ${meeting.title}`,
        preheader: `The meeting on ${fmtDate(meeting.startsAt)} won't hold.`,
        html:
            eyebrow("BlockHub Meeting · Cancelled") +
            h1(`${meeting.title} is cancelled`) +
            p(`Hi ${esc(first(name))}, sorry — this meeting has been cancelled and removed from your calendar.`) +
            details([
                ["Was", `${fmtDate(meeting.startsAt)} ${fmtTime(meeting.startsAt)}`],
            ]) +
            (reason ? quote(textToHtml(reason), "#f59e0b") : "") +
            button("Visit BlockHub", ctx.frontendUrl),
        text: `${meeting.title} (${fmtDate(meeting.startsAt)}) is cancelled. ${reason || ""}`,
    }),

    meeting_reminder: ({ name, meeting, joinUrl }) => ({
        subject: `⏰ Starts in 1 hour: ${meeting.title}`,
        preheader: `Today at ${fmtTime(meeting.startsAt)} on BlockHub Live`,
        html:
            eyebrow("BlockHub Meeting · Reminder") +
            h1("Your meeting starts in 1 hour") +
            p(`Hi ${esc(first(name))}, <strong style="color:#fff">${esc(meeting.title)}</strong> starts at ${esc(fmtTime(meeting.startsAt))}.`) +
            details([
                ["Date", fmtDate(meeting.startsAt)],
                ["Time", fmtTime(meeting.startsAt)],
                ["Host", meeting.hostName],
            ]) +
            button("Open the meeting", joinUrl) +
            small("Test your camera and mic a few minutes early on the join screen."),
        text: `${meeting.title} starts in 1 hour (${fmtTime(meeting.startsAt)}). Join: ${joinUrl}`,
    }),

    meeting_live: ({ name, meeting, joinUrl }) => ({
        subject: `🔴 Live now: ${meeting.title}`,
        preheader: `${meeting.hostName || "The host"} just started the call.`,
        html:
            eyebrow("BlockHub Meeting · Live now") +
            h1(`${meeting.title} is live`) +
            p(`Hi ${esc(first(name))}, the host has started the call. Jump in!`) +
            button("Join the meeting", joinUrl),
        text: `Live now: ${meeting.title}. Join: ${joinUrl}`,
    }),

    /* ======================================================
       SYSTEM
    ====================================================== */

    test_email: ({ sentBy }, ctx) => ({
        subject: "BlockHub email test ✅",
        preheader: "If you can read this, email is working.",
        html:
            eyebrow("Test") +
            h1("Email is working 🎉") +
            p(`This test was sent by ${esc(sentBy || "an admin")} from the BlockHub server.`) +
            button("Open BlockHub", ctx.frontendUrl),
        text: "BlockHub email test — it works.",
    }),
};

module.exports = { templates: T, fmtDate, fmtTime, fmtMoney };
