const mongoose = require("mongoose");


const FileSchema = new mongoose.Schema(
    {
        name: String,
        url: String,
        publicId: String,
        size: Number,
        type: String,
    },
    { _id: false }
);


const productSchema = new mongoose.Schema(
    {
        seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
        title: { type: String, required: true, trim: true },
        slug: { type: String, unique: true, required: true },
        fileType: String,
        shortDescription: { type: String, maxlength: 200, default: "" },
        description: { type: String, default: "" },
        category: { type: String, required: true },
        tags: [String],
        thumbnail: { url: String, publicId: String },
        previewImages: [{ url: String, publicId: String }],
        files: {
            type: [FileSchema],
            default: [],
        },
        whatYouGet: [{ type: String }],
        pricing: {
            type: { type: String, enum: ["free", "paid"], default: "free" },
            amount: { type: Number, default: 0 },
            currency: { type: String, enum: ["NGN", "USDT", "BNB"], default: "NGN" },
            discount: { type: Number, default: 0 },
        },
        visibility: { type: String, enum: ["public", "private"], default: "public" },
        status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
        totalSales: { type: Number, default: 0 },
        totalDownloads: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 },
        totalLikes: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },
        featured: { type: Boolean, default: false },
    },
    {
        timestamps: true,
        collection: "products",
    }

);

const Product = mongoose.model("Product", productSchema);


// console.log(Product.schema.path("files").instance);
// console.log(Product.schema.path("files").caster?.constructor?.name);
// console.dir(Product.schema.path("files"), { depth: 1 });

module.exports = Product;