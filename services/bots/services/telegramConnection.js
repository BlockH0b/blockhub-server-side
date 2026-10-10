const crypto = require("crypto");

const TelegramConnection =
    require("../../../models/telegramConnection");


const createTelegramConnection = async ({
    telegramId,
    username,
    firstName,
}) => {

    // ==========================================
    // GENERATE SECURE TOKEN
    // ==========================================

    const rawToken =
        crypto.randomBytes(32).toString("hex");


    // ==========================================
    // HASH TOKEN
    // ==========================================

    const tokenHash =
        crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");


    // ==========================================
    // EXPIRATION
    // ==========================================

    const expiresAt =
        new Date(
            Date.now() + 10 * 60 * 1000
        );


    // ==========================================
    // REMOVE OLD TOKENS
    // ==========================================

    await TelegramConnection.deleteMany({
        telegramId,
        used: false,
    });


    // ==========================================
    // CREATE CONNECTION
    // ==========================================

    await TelegramConnection.create({

        tokenHash,

        telegramId,

        telegramUsername:
            username,

        telegramFirstName:
            firstName,

        used: false,

        expiresAt,

    });


    // ==========================================
    // CREATE CONNECT URL
    // ==========================================

    const connectUrl =
        `https://blockhubglobal.xyz/connect-telegram?token=${encodeURIComponent(
            rawToken
        )}`;


    return connectUrl;
};


module.exports = {
    createTelegramConnection,
};