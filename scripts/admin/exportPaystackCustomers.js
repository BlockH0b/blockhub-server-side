// Downloads all Paystack customers into scripts/data/paystack_customers.json
// (private file - git-ignored). Needs PAYSTACK_SECRET_KEY in .env
// node scripts/admin/exportPaystackCustomers.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
const axios = require("axios");
const { saveJson } = require("../_lib/data");

async function main() {
    if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error("❌ PAYSTACK_SECRET_KEY is missing from .env");
        process.exit(1);
    }
    const all = [];
    for (let page = 1; ; page += 1) {
        const res = await axios.get("https://api.paystack.co/customer", {
            params: { perPage: 50, page },
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        });
        const customers = res.data?.data || [];
        if (!customers.length) break;
        all.push(
            ...customers.map((c) => ({
                email: c.email,
                name: c.first_name && c.last_name ? `${c.first_name} ${c.last_name}` : "No Name",
                phone: c.phone || null,
                createdAt: c.createdAt || null,
            }))
        );
        console.log(`Page ${page}: ${customers.length}`);
        await new Promise((r) => setTimeout(r, 100));
    }
    const file = saveJson("paystack_customers.json", all);
    console.log(`✅ ${all.length} customers saved to ${file}`);
}

main().catch((error) => {
    console.error("❌", error.response?.data || error.message);
    process.exit(1);
});
