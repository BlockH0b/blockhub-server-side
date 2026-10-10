/*
 * Shared database connection for one-off scripts.
 * Reads MONGODB_URI from Backend/.env - never hardcode it.
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const mongoose = require("mongoose");
const dns = require("dns");
const dnsPromises = require("node:dns/promises");

// Same DNS fix the server uses (Atlas SRV lookups)
dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);
dns.setDefaultResultOrder("ipv4first");

async function connect() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ MONGODB_URI is missing from Backend/.env");
        process.exit(1);
    }
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    console.log("✅ MongoDB connected");
    return mongoose;
}

async function disconnect() {
    await mongoose.connection.close().catch(() => null);
}

/** Run an async main() with connect/disconnect and a non-zero exit on error */
function run(main) {
    connect()
        .then(main)
        .then(disconnect)
        .catch(async (error) => {
            console.error("❌", error?.message || error);
            await disconnect();
            process.exit(1);
        });
}

module.exports = { connect, disconnect, run, mongoose };
