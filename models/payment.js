const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    username: { type: String, required: true },
    product_id: { type: String, required: true },
    is_call_payment: { type: Boolean, default: false },
    product_title: { type: String, required: true },
    product_price: { type: Number, required: true },
    bookingLink: { type: String },   
    status: { type: Boolean, default: false },
    token: { type: String, unique: true, sparse: true },
    tokenUsed: { type: Boolean, default: false },
    expiresAt: { type: Date },
}, {
    timestamps: true,
    collection: 'payment'
});
module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);