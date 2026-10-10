/*
 * Course completion certificate
 * ------------------------------------------------------------
 * Draws a BlockHub certificate (PNG) with node-canvas and uploads
 * it to Cloudinary (folder "certificates"). Returns the URL.
 *
 * Before this existed, finishing a course called two functions that
 * were never defined, which crashed the whole server 3 seconds later.
 */

const crypto = require("crypto");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;

const WIDTH = 1600;
const HEIGHT = 1130;

function fitText(ctx, text, maxWidth, startSize, weight = "700") {
    let size = startSize;
    do {
        ctx.font = `${weight} ${size}px sans-serif`;
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 2;
    } while (size > 18);
    return size;
}

function drawCertificate({ name, course, date, certificateId }) {
    // Required lazily so a missing native build never breaks server start
    const { createCanvas } = require("canvas");
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#030303";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Soft green glow
    const glow = ctx.createRadialGradient(WIDTH * 0.8, 0, 50, WIDTH * 0.8, 0, 900);
    glow.addColorStop(0, "rgba(72,255,117,0.18)");
    glow.addColorStop(1, "rgba(72,255,117,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Purple glow bottom-left
    const glow2 = ctx.createRadialGradient(0, HEIGHT, 50, 0, HEIGHT, 800);
    glow2.addColorStop(0, "rgba(52,1,204,0.25)");
    glow2.addColorStop(1, "rgba(52,1,204,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Frame
    ctx.strokeStyle = "rgba(72,255,117,0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(50, 50, WIDTH - 100, HEIGHT - 100);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(70, 70, WIDTH - 140, HEIGHT - 140);

    // Logo mark
    ctx.fillStyle = "#0d2a14";
    ctx.fillRect(WIDTH / 2 - 40, 130, 80, 80);
    ctx.strokeStyle = "#1d5a2c";
    ctx.strokeRect(WIDTH / 2 - 40, 130, 80, 80);
    ctx.fillStyle = "#48FF75";
    ctx.font = "900 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", WIDTH / 2, 172);

    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#48FF75";
    ctx.font = "700 22px sans-serif";
    ctx.fillText("B L O C K H U B   A C A D E M Y", WIDTH / 2, 270);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 64px sans-serif";
    ctx.fillText("Certificate of Completion", WIDTH / 2, 370);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "400 26px sans-serif";
    ctx.fillText("This certifies that", WIDTH / 2, 450);

    const safeName = String(name || "BlockHub Learner");
    fitText(ctx, safeName, WIDTH - 300, 84, "800");
    ctx.fillStyle = "#ffffff";
    ctx.fillText(safeName, WIDTH / 2, 560);

    // Underline
    ctx.fillStyle = "#48FF75";
    ctx.fillRect(WIDTH / 2 - 220, 590, 440, 3);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "400 26px sans-serif";
    ctx.fillText("has successfully completed the course", WIDTH / 2, 660);

    const safeCourse = String(course || "BlockHub course");
    fitText(ctx, safeCourse, WIDTH - 300, 48, "700");
    ctx.fillStyle = "#48FF75";
    ctx.fillText(safeCourse, WIDTH / 2, 740);

    // Footer
    const issued = new Date(date || Date.now()).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    ctx.font = "400 22px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "left";
    ctx.fillText("Issued", 170, 930);
    ctx.textAlign = "right";
    ctx.fillText("Certificate ID", WIDTH - 170, 930);

    ctx.font = "700 26px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(issued, 170, 970);
    ctx.textAlign = "right";
    ctx.fillText(certificateId, WIDTH - 170, 970);

    ctx.textAlign = "center";
    ctx.font = "400 20px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("blockhubglobal.xyz", WIDTH / 2, 1000);

    return canvas.toBuffer("image/png");
}

function uploadPng(buffer, publicId) {
    cloudinary.config({
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.API_KEY,
        api_secret: process.env.API_SECRET,
    });

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "certificates", public_id: publicId, resource_type: "image", overwrite: true },
            (error, result) => (error ? reject(error) : resolve(result.secure_url))
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}

/**
 * @returns {Promise<{ url: string, certificateId: string }>}
 */
async function generateCertificate({ enrollmentId, name, course, date }) {
    const certificateId = `BH-${crypto
        .createHash("sha256")
        .update(String(enrollmentId))
        .digest("hex")
        .slice(0, 10)
        .toUpperCase()}`;

    const png = drawCertificate({ name, course, date, certificateId });
    const url = await uploadPng(png, certificateId);
    return { url, certificateId };
}

module.exports = { generateCertificate };
