const express = require("express");
const router = express.Router();
const auth = require("../middlewave/auth");
const Project = require("../models/project");
const User = require("../models/user");
const Campaign = require("../models/Campaign");
const CampaignTask = require("../models/CampaignTask");

router.post("/create", auth, async (req, res) => {
    try {

        const {
            name,
            description,
            xUsername,
        } = req.body;

        //----------------------------------
        // Validation
        //----------------------------------

        if (!name || !description || !xUsername) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields.",
            });
        }

        //----------------------------------
        // Slug
        //----------------------------------

        const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        //----------------------------------
        // Exists
        //----------------------------------

        const existing = await Project.findOne({
            $or: [
                {
                    slug,
                },
                {
                    "x.username": xUsername.toLowerCase(),
                },
            ],
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message:
                    "A project with this name or X username already exists.",
            });
        }

        //----------------------------------
        // Create
        //----------------------------------

        const project = await Project.create({
            owner: req.user._id,

            name,

            slug,

            description,

            x: {
                username: xUsername.toLowerCase(),
                profileImage: `https://unavatar.io/twitter/${xUsername}`,
            },
        });

        await User.findByIdAndUpdate(
            req.user._id,
            {
                $inc: {
                    "grindFi.totalProjectsCreated": 1,
                },
            }
        );


        return res.json({
            success: true,
            message: "Project created successfully.",
            project,
        });

    } catch (err) {

        console.log(err);

        return res.status(500).json({
            success: false,
            message: "Unable to create project.",
        });

    }
});

router.get("/my_projects", auth, async (req, res) => {
    try {

        const projects = await Project.find({
            owner: req.user._id,
        })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            projects,
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch projects.",
        });

    }
});

router.get("/:slug", auth, async (req, res) => {
    try {
        const { slug } = req.params;

        const project = await Project.findOne({
            slug,
            owner: req.user._id,
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found.",
            });
        }

        return res.status(200).json({
            success: true,
            project,
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch project.",
        });
    }
});

router.get("/:slug/campaigns", auth, async (req, res) => {
    try {

        const { slug } = req.params;

        //----------------------------------
        // Find Project
        //----------------------------------

        const project = await Project.findOne({
            slug,
            owner: req.user._id,
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found.",
            });
        }

        //----------------------------------
        // Campaigns
        //----------------------------------

        const campaigns = await Campaign.find({
            project: project._id,
        }).sort({
            createdAt: -1,
        }).lean();

        const campaignIds = campaigns.map(campaign => campaign._id);

        const tasks = await CampaignTask.find({
            campaign: { $in: campaignIds },
        }).sort({
            order: 1,
        }).lean();

        const campaignsWithTasks = campaigns.map(campaign => ({
            ...campaign,
            tasks: tasks.filter(
                task => task.campaign.toString() === campaign._id.toString()
            ),
        }));

        return res.status(200).json({
            success: true,
            campaigns: campaignsWithTasks,
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch campaigns.",
        });

    }
});


module.exports = router;