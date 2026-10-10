const notify = require("../services/email/notify");
const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const CourseSubmission = require('../models/CourseSubmit');
const auth = require('../middlewave/auth');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const sanitizeSeller = require('../utils/sanitizeSeller');



const generateSlug = (title) => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "") // remove special chars
        .replace(/\s+/g, "-")         // spaces → dash
        .replace(/-+/g, "-");         // collapse multiple dashes
};


// Create a new course
// Inside your /create_course route
router.post("/create_product", auth, async (req, res) => {
    try {
        const user = req.user;

        const seller = await Seller.findById(user.sellerProfile);

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller profile not found",
            });
        }

        const {
            title,
            shortDescription,
            description,
            category,
            tags,
            thumbnail,
            previewImages,
            files,
            pricing,
            visibility,
            whatYouGet,
            deliveryType,
            externalLink,
            license,
            githubRepo,
            embedUrl,
            apiEndpoint,
        } = req.body;

        // console.log(req.body)

        // ---------------- VALIDATIONS ----------------
        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Product title is required",
            });
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Product category is required",
            });
        }



        // ---------------- SLUG GENERATOR ----------------
        const generateSlug = (text) => {
            return text
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-");
        };

        let baseSlug = generateSlug(title);
        let slug = baseSlug;

        let counter = 1;

        while (await Product.findOne({ slug })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        const safeFiles =
            typeof files === "string"
                ? JSON.parse(files)
                : files;

        const safePreviewImages =
            typeof previewImages === "string"
                ? JSON.parse(previewImages)
                : previewImages;

        // ---------------- CREATE PRODUCT ----------------
        const newProduct = await Product.create({
            seller: seller._id,
            title,
            slug,
            whatYouGet: Array.isArray(whatYouGet)
                ? whatYouGet.filter(Boolean)
                : [],

            shortDescription: shortDescription || "",
            description: description || "",
            category,
            tags: tags || [],

            thumbnail: thumbnail || {},
            files: safeFiles || [],
            previewImages: safePreviewImages || [],

            pricing: pricing || {
                type: "free",
                amount: 0,
                currency: "NGN",
                discount: 0,
            },

            visibility: visibility || "public",
            status: "draft",

            // DELIVERY SYSTEM
            deliveryType: deliveryType || "file",
            externalLink: externalLink || "",
            license: license || "",
            githubRepo: githubRepo || "",
            embedUrl: embedUrl || "",
            apiEndpoint: apiEndpoint || "",
        });

        // ---------------- UPDATE SELLER ----------------
        seller.productsCreated.push(newProduct._id);
        seller.totalDraftProducts += 1;

        await seller.save();


        const updatedSeller = await Seller.findById(seller._id)
            .populate("productsCreated");

        // ---------------- RETURN UPDATED LIST ----------------
        const allProducts = await Product.find({
            seller: seller._id,
        }).sort({ createdAt: -1 });



        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            seller: updatedSeller,
            product: newProduct,
            allProducts,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
});


router.put("/update_product", auth, async (req, res) => {
    try {
        const user = req.user;

        const seller = await Seller.findById(user.sellerProfile);

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller profile not found",
            });
        }

        const {
            productId,
            title,
            whatYouGet,
            slug,
            shortDescription,
            description,
            category,
            tags,
            thumbnail,
            previewImages,
            files,
            pricing,
            visibility,
            featured,

            // ✅ NEW DELIVERY FIELDS
            deliveryType,
            externalLink,
            license,
            githubRepo,
            embedUrl,
            apiEndpoint,
        } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }



        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        if (String(product.seller) !== String(seller._id)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to edit this product.",
            });
        }

        if (whatYouGet !== undefined) {
            product.whatYouGet = Array.isArray(whatYouGet)
                ? whatYouGet.filter(Boolean)
                : [];
        }


        // slug check
        if (slug && slug !== product.slug) {
            const existingProduct = await Product.findOne({ slug });

            if (existingProduct) {
                return res.status(400).json({
                    success: false,
                    message: "Slug already exists.",
                });
            }

            product.slug = slug;
        }

        // core fields
        product.title = title || product.title;
        product.shortDescription = shortDescription || product.shortDescription;
        product.description = description || product.description;
        product.category = category || product.category;

        if (tags) product.tags = tags;
        if (thumbnail) product.thumbnail = thumbnail;
        if (previewImages) product.previewImages = previewImages;
        if (files) product.files = files;

        if (pricing) {
            product.pricing = {
                ...product.pricing,
                ...pricing,
            };
        }

        if (visibility) product.visibility = visibility;
        if (typeof featured === "boolean") product.featured = featured;

        // ✅ NEW DELIVERY UPDATE
        if (deliveryType) product.deliveryType = deliveryType;
        if (externalLink !== undefined) product.externalLink = externalLink;
        if (license !== undefined) product.license = license;
        if (githubRepo !== undefined) product.githubRepo = githubRepo;
        if (embedUrl !== undefined) product.embedUrl = embedUrl;
        if (apiEndpoint !== undefined) product.apiEndpoint = apiEndpoint;

        await product.save();

        const updatedSeller = await Seller.findById(seller._id)
            .populate("productsCreated");

        const allProducts = await Product.find({
            seller: seller._id,
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product,
            seller: sanitizeSeller(updatedSeller),
            allProducts,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message,
        });
    }
});



// DELETE a course
router.delete("/delete_product", auth, async (req, res) => {
    try {
        const user = req.user;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }

        const seller = await Seller.findById(user.sellerProfile);

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller profile not found",
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Ensure this seller owns the product
        if (String(product.seller) !== String(seller._id)) {
            return res.status(403).json({
                success: false,
                message: "Not allowed to delete this product",
            });
        }

        // Remove product from seller
        seller.productsCreated = seller.productsCreated.filter(
            id => String(id) !== String(productId)
        );

        // Update seller statistics
        if (product.status === "draft") {
            seller.totalDraftProducts = Math.max(
                0,
                seller.totalDraftProducts - 1
            );
        }

        if (product.status === "published") {
            seller.totalActiveProducts = Math.max(
                0,
                seller.totalActiveProducts - 1
            );
        }

        await seller.save();
        await product.deleteOne();


        const updatedSeller = await Seller.findById(seller._id)
            .populate("productsCreated");

        const allProducts = await Product.find({
            seller: seller._id,
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully",
            seller: sanitizeSeller(updatedSeller),
            allProducts,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message,
        });
    }
});

// PUBLISH course → make it live
router.put("/publish_product", auth, async (req, res) => {
    try {
        const user = req.user;
        const { productId } = req.body;

        const seller = await Seller.findById(user.sellerProfile);

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller profile not found",
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        if (String(product.seller) !== String(seller._id)) {
            return res.status(403).json({
                success: false,
                message: "Not allowed to publish this product",
            });
        }

        // Prevent publishing twice
        if (product.status === "published") {
            return res.status(400).json({
                success: false,
                message: "Product is already published",
            });
        }

        product.status = "published";

        await product.save();

        notify.productPublished(product, seller);

        seller.totalActiveProducts += 1;

        seller.totalDraftProducts = Math.max(
            0,
            seller.totalDraftProducts - 1
        );

        await seller.save();

        const updatedSeller = await Seller.findById(seller._id)
            .populate("productsCreated");

        const allProducts = await Product.find({
            seller: seller._id,
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Product published successfully",
            product,
            seller: sanitizeSeller(updatedSeller),
            allProducts,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message,
        });
    }
});

// POST /tutor_course/duplicate_course
router.post("/duplicate_product", auth, async (req, res) => {
    try {
        const user = req.user;
        const { productId } = req.body;

        const seller = await Seller.findById(user.sellerProfile);

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller profile not found",
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Ensure this seller owns the product
        if (String(product.seller) !== String(seller._id)) {
            return res.status(403).json({
                success: false,
                message: "Not allowed to duplicate this product",
            });
        }

        const duplicatedProduct = new Product({
            ...product.toObject(),
            _id: undefined,
            title: `${product.title} (Copy)`,
            slug: `${product.slug}-copy-${Date.now()}`,
            status: "draft",
            totalSales: 0,
            totalDownloads: 0,
            totalViews: 0,
            totalLikes: 0,
            totalReviews: 0,
            averageRating: 0,
            featured: false,
            createdAt: undefined,
            updatedAt: undefined,
        });

        await duplicatedProduct.save();

        seller.productsCreated.push(duplicatedProduct._id);
        seller.totalDraftProducts += 1;

        await seller.save();

        const updatedSeller = await Seller.findById(seller._id)
            .populate("productsCreated");

        const allProducts = await Product.find({
            seller: seller._id,
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Product duplicated successfully",
            seller: sanitizeSeller(updatedSeller),
            product: duplicatedProduct,
            allProducts,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message,
        });
    }
});




// router.post("/submit_course_for_review", verifyTutorToken, async (req, res) => {
//     try {
//         const tutor = req.tutor;
//         const { title, description } = req.body;

//         if (!title || !description) {
//             return res.status(400).json({ message: "Title and description are required" });
//         }

//         const newCourse = new CourseSubmission({
//             tutor: tutor._id,
//             courseTitle: title,
//             description: description
//         });

//         await newCourse.save();

//         const courses = await CourseSubmission.find({ tutor: tutor._id })
//             .populate({
//                 path: "tutor",
//                 populate: {
//                     path: "user",
//                     select: "fullName profileImage"
//                 }
//             })
//             .sort({ createdAt: -1 });

//         const formattedCourses = courses.map(course => ({
//             id: course._id,
//             courseTitle: course.courseTitle,
//             description: course.description,
//             status: course.status,
//             statusMessage: course.statusMessage,

//             tutorName: course.tutor?.user?.fullName || "Unknown",
//             tutorImage: course.tutor?.user?.profileImage || ""
//         }));

//         res.status(201).json({
//             message: "Course submitted successfully",
//             courses: formattedCourses
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });
//     }
// });
// router.get("/get_all_submitions", verifyTutorToken, async (req, res) => {
//     try {
//         // Fetch all submissions
//         const courses = await CourseSubmission.find()
//             .populate({
//                 path: "tutor",
//                 populate: {
//                     path: "user",
//                     select: "fullName profileImage"
//                 }
//             })
//             .sort({ createdAt: -1 });

//         const formattedCourses = courses.map(course => ({
//             id: course._id,
//             courseTitle: course.courseTitle,
//             description: course.description,
//             status: course.status,
//             statusMessage: course.statusMessage,
//             tutorName: course.tutor?.user?.fullName || "Unknown",
//             tutorImage: course.tutor?.user?.profileImage || ""
//         }));

//         res.status(200).json({
//             message: "All course submissions fetched successfully",
//             courses: formattedCourses
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error", courses: [] });
//     }
// });


// // GET all submissions (Admin)
// router.get("/get_course_submissions", async (req, res) => {
//     try {

//         const submissions = await CourseSubmission.find()
//             .populate({
//                 path: "tutor",
//                 populate: {
//                     path: "user",
//                     select: "fullName profileImage"
//                 }
//             })
//             .sort({ createdAt: -1 });

//         const formatted = submissions.map(course => ({
//             id: course._id,
//             courseTitle: course.courseTitle,
//             description: course.description,
//             status: course.status,
//             statusMessage: course.statusMessage,
//             tutorName: course.tutor?.user?.fullName || "Unknown",
//             tutorImage: course.tutor?.user?.profileImage || ""
//         }));

//         res.json({
//             message: "Submissions fetched",
//             courses: formatted
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });
//     }
// });


// // Toggle course approval
// router.patch("/toggle_course_status", async (req, res) => {
//     try {

//         const { status, reason, courseId } = req.body;

//         if (!["approved", "rejected", "pending"].includes(status)) {
//             return res.status(400).json({ message: "Invalid status" });
//         }

//         const course = await CourseSubmission.findById(courseId);

//         if (!course) {
//             return res.status(404).json({ message: "Course not found" });
//         }

//         course.status = status;
//         course.statusMessage = reason || "";

//         await course.save();

//         res.json({
//             message: "Course status updated",
//             course
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });
//     }
// });

// // DELETE a course submission
// router.delete("/delete_course_submittion", async (req, res) => {
//     try {
//         const { courseId } = req.body;

//         if (!courseId) {
//             return res.status(400).json({ message: "Course ID is required" });
//         }

//         const course = await CourseSubmission.findById(courseId);
//         if (!course) {
//             return res.status(404).json({ message: "Course submission not found" });
//         }

//         await course.deleteOne();

//         // Fetch remaining submissions after deletion
//         const submissions = await CourseSubmission.find()
//             .populate({
//                 path: "tutor",
//                 populate: { path: "user", select: "fullName profileImage" }
//             })
//             .sort({ createdAt: -1 });

//         const formatted = submissions.map(c => ({
//             id: c._id,
//             courseTitle: c.courseTitle,
//             description: c.description,
//             status: c.status,
//             statusMessage: c.statusMessage,
//             tutorName: c.tutor?.user?.fullName || "Unknown",
//             tutorImage: c.tutor?.user?.profileImage || ""
//         }));

//         res.json({
//             message: "Course submission deleted successfully",
//             courses: formatted
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });
//     }
// });


// // GET all uploaded courses (Admin view)
// router.get("/get_all_uploaded_course", async (req, res) => {
//     try {

//         const courses = await Course.find({
//             tutor: { $ne: "69a9403baad07a476521df9d" }
//         })

//             .populate({
//                 path: "tutor",
//                 populate: {
//                     path: "user",
//                     select: "fullName profileImage"
//                 }
//             })
//             .sort({ createdAt: -1 });

//         const formatted = courses.map(course => ({
//             id: course._id,

//             // FIXED FIELDS
//             courseTitle: course.name,
//             description: course.overview,

//             courseImage: course.thumbnail?.url || "",

//             tutorName: course.tutor?.user?.fullName || "Unknown",
//             tutorImage: course.tutor?.user?.profileImage || "",

//             totalLessons: course.lessons?.length || 0,

//             // NEW STATUS FIELD (IMPORTANT)
//             status: course.isPublished ? "published" : "draft"
//         }));

//         res.json({
//             message: "Courses fetched successfully",
//             courses: formatted
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });
//     }
// });
module.exports = router;