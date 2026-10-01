const express = require("express");
const router = express.Router();

const slugify = require("slugify");

const auth = require("../middlewave/auth");

const Campaign = require("../models/Campaign");
const CampaignTask = require("../models/CampaignTask");
const Project = require("../models/project");
const User = require("../models/user");
const CampaignParticipant = require("../models/CampaignParticipant");
const CampaignSubmission = require("../models/CampaignSubmission");



router.get("/campaigns", async (req, res) => {
    try {
        const campaigns = await Campaign.find()
            .populate({
                path: "project",
                select: "name slug logo banner verified",
            })
            .populate({
                path: "owner",
                select: "fullName username profileImage verified",
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            campaigns,
        });
    } catch (error) {
        console.error("Get Campaigns Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch campaigns.",
        });
    }
});

router.post("/campaign", async (req, res) => {
    try {
        const { slug } = req.body;

        if (!slug) {
            return res.status(400).json({
                success: false,
                message: "Campaign slug is required.",
            });
        }

        const campaign = await Campaign.findOne({ slug })
            .populate({
                path: "project",
                select: "name slug logo banner verified description website twitterHandle",
            })
            .populate({
                path: "owner",
                select: "fullName username profileImage verified",
            })
            .lean();

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        const tasks = await CampaignTask.find({
            campaign: campaign._id,
        }).sort({ order: 1 });

        campaign.tasks = tasks;

        return res.status(200).json({
            success: true,
            campaign,
        });
    } catch (error) {
        console.error("Get Campaign Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch campaign.",
        });
    }
});

router.post("/create", auth, async (req, res) => {
    try {

        const userId = req.user.id;

        const {
            project, title, description, hashtags, startDate, endDate,
            maxParticipants, reward, requirements, tasks, banner,
        } = req.body;

        //----------------------------------
        // Validate Project
        //----------------------------------

        const existingProject = await Project.findById(project);

        if (!existingProject) {
            return res.status(404).json({
                success: false,
                message: "Project not found.",
            });
        }

        if (existingProject.owner.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        //----------------------------------
        // Generate Slug
        //----------------------------------

        let slug = slugify(title, {
            lower: true,
            strict: true,
        });

        const exists = await Campaign.exists({ slug });

        if (exists) {
            slug = `${slug}-${Date.now()}`;
        }

        //----------------------------------
        // Create Campaign
        //----------------------------------

        const campaign = await Campaign.create({
            owner: userId,
            project,
            title,
            slug,
            description,
            banner,

            hashtags,
            startDate,
            endDate,
            maxParticipants,

            requirements,

            reward: {
                ...reward,
                distributed: 0,
                remaining:
                    reward.type === "pool"
                        ? reward.totalPool
                        : reward.amount,
            },

            status: "draft",
        });

        //----------------------------------
        // Create Tasks
        //----------------------------------

        if (tasks?.length) {

            const formattedTasks = tasks.map((task, index) => ({
                campaign: campaign._id,
                project,

                title: task.title,
                description: task.description,

                type: task.type,
                url: task.url,

                reward: task.reward,

                required: task.required,
                order: index + 1,
                verification: task.verification,
            }));

            await CampaignTask.insertMany(formattedTasks);
        }

        //----------------------------------
        // Update Project Stats
        //----------------------------------

        await Project.findByIdAndUpdate(project, {
            $inc: {
                "stats.campaigns": 1,
                "stats.activeCampaigns": 1,
            },
        });

        //----------------------------------
        // Update User Stats
        //----------------------------------

        await User.findByIdAndUpdate(userId, {
            $inc: {
                "grindFi.totalCampaignsCreated": 1,
                "grindFi.activeCampaigns": 1,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Campaign created successfully.",
            campaign,
        });

    } catch (error) {

        console.error("Create Campaign Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create campaign.",
        });

    }
});

router.put("/update/:campaignId", auth, async (req, res) => {
    try {

        const userId = req.user.id;
        const { campaignId } = req.params;

        const {
            project,
            title,
            description,
            banner,
            hashtags,
            startDate,
            endDate,
            maxParticipants,
            reward,
            requirements,
            tasks,
        } = req.body;

        //----------------------------------
        // Validate Campaign
        //----------------------------------

        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        //----------------------------------
        // Ownership Check
        //----------------------------------

        if (campaign.owner.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        //----------------------------------
        // Validate Project
        //----------------------------------

        const existingProject = await Project.findById(project);

        if (!existingProject) {
            return res.status(404).json({
                success: false,
                message: "Project not found.",
            });
        }

        //----------------------------------
        // Update Campaign
        //----------------------------------

        campaign.project = project;
        campaign.title = title;
        campaign.description = description;
        campaign.banner = banner;
        campaign.hashtags = hashtags;
        campaign.startDate = startDate;
        campaign.endDate = endDate;
        campaign.maxParticipants = maxParticipants;
        campaign.requirements = requirements;

        campaign.reward = {
            ...reward,
            distributed: campaign.reward.distributed || 0,
            remaining:
                reward.type === "pool"
                    ? reward.totalPool - (campaign.reward.distributed || 0)
                    : reward.amount - (campaign.reward.distributed || 0),
        };

        await campaign.save();

        //----------------------------------
        // Replace Tasks
        //----------------------------------

        await CampaignTask.deleteMany({
            campaign: campaign._id,
        });

        if (tasks?.length) {

            const formattedTasks = tasks.map((task, index) => ({
                campaign: campaign._id,
                project,

                title: task.title,
                description: task.description,

                type: task.type,
                url: task.url,

                reward: task.reward,

                verification: task.verification,

                order: index + 1,
            }));

            await CampaignTask.insertMany(formattedTasks);
        }

        //----------------------------------
        // Success
        //----------------------------------

        return res.json({
            success: true,
            message: "Campaign updated successfully.",
            campaign,
        });

    } catch (error) {

        console.error("Update Campaign Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update campaign.",
        });

    }
});

router.post("/duplicate/:campaignId", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { campaignId } = req.params;

        //----------------------------------
        // Find Campaign
        //----------------------------------

        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        //----------------------------------
        // Ownership Check
        //----------------------------------

        if (campaign.owner.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        //----------------------------------
        // Generate New Slug
        //----------------------------------

        let slug = slugify(`${campaign.title}-copy`, {
            lower: true,
            strict: true,
        });

        if (await Campaign.exists({ slug })) {
            slug += `-${Date.now()}`;
        }

        //----------------------------------
        // Duplicate Campaign
        //----------------------------------

        const newCampaign = await Campaign.create({
            owner: campaign.owner,
            project: campaign.project,

            title: `${campaign.title} (Copy)`,
            slug,

            description: campaign.description,
            banner: campaign.banner,

            hashtags: campaign.hashtags,

            startDate: campaign.startDate,
            endDate: campaign.endDate,

            maxParticipants: campaign.maxParticipants,

            requirements: campaign.requirements,

            reward: {
                ...campaign.reward.toObject(),
                distributed: 0,
                remaining:
                    campaign.reward.type === "pool"
                        ? campaign.reward.totalPool
                        : campaign.reward.amount,
            },

            status: "draft",
        });

        //----------------------------------
        // Duplicate Tasks
        //----------------------------------

        const tasks = await CampaignTask.find({
            campaign: campaign._id,
        });

        if (tasks.length) {

            await CampaignTask.insertMany(
                tasks.map(task => ({
                    campaign: newCampaign._id,
                    project: newCampaign.project,

                    title: task.title,
                    description: task.description,

                    type: task.type,
                    url: task.url,

                    reward: task.reward,

                    verification: task.verification,

                    required: task.required,

                    order: task.order,
                }))
            );

        }

        //----------------------------------
        // Update Stats
        //----------------------------------

        await Project.findByIdAndUpdate(campaign.project, {
            $inc: {
                "stats.campaigns": 1,
                "stats.activeCampaigns": 1,
            },
        });

        await User.findByIdAndUpdate(userId, {
            $inc: {
                "grindFi.totalCampaignsCreated": 1,
                "grindFi.activeCampaigns": 1,
            },
        });

        return res.json({
            success: true,
            message: "Campaign duplicated successfully.",
            campaign: newCampaign,
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to duplicate campaign.",
        });

    }
});

router.delete("/delete/:campaignId", auth, async (req, res) => {
    try {

        const userId = req.user.id;
        const { campaignId } = req.params;

        //----------------------------------
        // Find Campaign
        //----------------------------------

        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        //----------------------------------
        // Ownership Check
        //----------------------------------

        if (campaign.owner.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        //----------------------------------
        // Delete Tasks
        //----------------------------------

        await CampaignTask.deleteMany({
            campaign: campaign._id,
        });

        //----------------------------------
        // Delete Campaign
        //----------------------------------

        await Campaign.findByIdAndDelete(campaignId);

        //----------------------------------
        // Update Project Stats
        //----------------------------------

        await Project.findByIdAndUpdate(campaign.project, {
            $inc: {
                "stats.campaigns": -1,
                "stats.activeCampaigns": -1,
            },
        });

        //----------------------------------
        // Update User Stats
        //----------------------------------

        await User.findByIdAndUpdate(userId, {
            $inc: {
                "grindFi.totalCampaignsCreated": -1,
                "grindFi.activeCampaigns": -1,
            },
        });

        return res.json({
            success: true,
            message: "Campaign deleted successfully.",
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to delete campaign.",
        });

    }
});

router.get("/participants/:campaignId", auth, async (req, res) => {
    try {

        const userId = req.user.id;
        const { campaignId } = req.params;

        //----------------------------------
        // Validate Campaign
        //----------------------------------

        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        //----------------------------------
        // Ownership Check
        //----------------------------------

        if (campaign.owner.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        //----------------------------------
        // Fetch Participants
        //----------------------------------

        const participants = await CampaignParticipant.find({
            campaign: campaignId,
        })
            .populate(
                "user",
                "firstName lastName username email profileImage avatar"
            )
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            participants,
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch participants.",
        });

    }
});


router.get("/submissions/:campaignId", auth, async (req, res) => {
    try {

        const userId = req.user.id;
        const { campaignId } = req.params;

        //----------------------------------
        // Validate Campaign
        //----------------------------------

        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        //----------------------------------
        // Ownership Check
        //----------------------------------

        if (campaign.owner.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        //----------------------------------
        // Fetch Submissions
        //----------------------------------

        const submissions = await CampaignSubmission.find({
            campaign: campaignId,
        })
            .populate(
                "user",
                "firstName lastName username email profileImage avatar"
            )
            .populate(
                "task",
                "title type reward"
            )
            .populate(
                "participant"
            )
            .populate(
                "reviewedBy",
                "firstName lastName username"
            )
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            submissions,
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch submissions.",
        });

    }
});

router.post("/join/:campaignId", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { campaignId } = req.params;

        //----------------------------------
        // Find Campaign
        //----------------------------------

        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        //----------------------------------
        // Campaign Status
        //----------------------------------



        const now = new Date();

        if (now < campaign.startDate) {
            return res.status(400).json({
                success: false,
                message: "Campaign has not started yet.",
            });
        }

        if (now > campaign.endDate) {
            return res.status(400).json({
                success: false,
                message: "Campaign has ended.",
            });
        }

        //----------------------------------
        // Max Participants
        //----------------------------------

        if (
            campaign.maxParticipants > 0 &&
            campaign.stats.participants >= campaign.maxParticipants
        ) {
            return res.status(400).json({
                success: false,
                message: "Campaign is full.",
            });
        }

        //----------------------------------
        // Already Joined?
        //----------------------------------

        const existingParticipant =
            await CampaignParticipant.findOne({
                campaign: campaign._id,
                user: userId,
            });

        if (existingParticipant) {
            return res.status(400).json({
                success: false,
                message: "You have already joined this campaign.",
            });
        }

        //----------------------------------
        // Count Tasks
        //----------------------------------

        const totalTasks = await CampaignTask.countDocuments({
            campaign: campaign._id,
        });

        //----------------------------------
        // Join Campaign
        //----------------------------------

        const participant =
            await CampaignParticipant.create({
                campaign: campaign._id,
                project: campaign.project,
                user: userId,
                totalTasks,
                completedTasks: 0,
                rewardEarned: 0,
                rewardClaimed: false,
                status: "joined",
            });

        //----------------------------------
        // Update Campaign Stats
        //----------------------------------

        await Campaign.findByIdAndUpdate(
            campaign._id,
            {
                $inc: {
                    "stats.participants": 1,
                },
            }
        );

        //----------------------------------
        // Update Project Stats
        //----------------------------------

        await Project.findByIdAndUpdate(
            campaign.project,
            {
                $inc: {
                    "stats.participants": 1,
                },
            }
        );

        //----------------------------------
        // Update User Stats
        //----------------------------------

        await User.findByIdAndUpdate(
            userId,
            {
                $inc: {
                    "grindFi.totalCampaignsJoined": 1,
                    "grindFi.activeCampaigns": 1,
                },
            }
        );

        //----------------------------------
        // Success
        //----------------------------------

        return res.status(201).json({
            success: true,
            message: "Successfully joined campaign.",
            participant,
        });

    } catch (error) {

        console.error("Join Campaign Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to join campaign.",
        });

    }
});

router.get("/my-campaigns", auth, async (req, res) => {
    try {

        const userId = req.user.id;

        //----------------------------------
        // Get Joined Campaigns
        //----------------------------------

        const participants = await CampaignParticipant.find({
            user: userId,
        })
            .populate({
                path: "campaign",
                populate: [
                    {
                        path: "project",
                        select: "name slug banner verified x",
                    },
                    {
                        path: "owner",
                        select: "fullName profileImage verified twitterHandle",
                    },
                ],
            })
            .sort({ createdAt: -1 });

        //----------------------------------
        // Build Response
        //----------------------------------



        const campaigns = await Promise.all(

            participants.map(async (participant) => {

                if (!participant.campaign) return null;

                const tasks = await CampaignTask.find({
                    campaign: participant.campaign._id,
                }).sort({ order: 1 });

                const submissions = await CampaignSubmission.find({
                    campaign: participant.campaign._id,
                    user: userId,
                })
                    .populate("task", "title type reward")
                    .sort({ createdAt: -1 });
                return {
                    ...participant.campaign.toObject(),

                    participant: {
                        _id: participant._id,
                        joinedAt: participant.joinedAt,
                        completedTasks: participant.completedTasks,
                        totalTasks: participant.totalTasks,
                        rewardEarned: participant.rewardEarned,
                        rewardClaimed: participant.rewardClaimed,
                        status: participant.status,
                    },

                    tasks,
                    submissions,
                };

            })

        );






        //----------------------------------
        // Remove deleted campaigns
        //----------------------------------

        const filteredCampaigns = campaigns.filter(Boolean);

        //----------------------------------
        // Success
        //----------------------------------

        return res.status(200).json({
            success: true,
            campaigns: filteredCampaigns,
        });

    } catch (error) {

        console.error("My Campaigns Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch your campaigns.",
        });

    }
});

router.post("/submit-task", auth, async (req, res) => {
    try {

        const userId = req.user.id;

        const {
            campaignId,
            taskId,
            submission = {},
        } = req.body;

        //----------------------------------
        // Validate Input
        //----------------------------------

        if (!campaignId || !taskId) {
            return res.status(400).json({
                success: false,
                message: "Campaign ID and Task ID are required.",
            });
        }

        //----------------------------------
        // Find Campaign
        //----------------------------------

        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        //----------------------------------
        // Check Campaign Status
        //----------------------------------

        const now = new Date();

        if (now < campaign.startDate) {
            return res.status(400).json({
                success: false,
                message: "Campaign has not started yet.",
            });
        }

        if (now > campaign.endDate) {
            return res.status(400).json({
                success: false,
                message: "Campaign has ended.",
            });
        }

        if (
            ["paused", "cancelled", "completed"].includes(
                campaign.status
            )
        ) {
            return res.status(400).json({
                success: false,
                message: `Campaign is currently ${campaign.status}.`,
            });
        }

        //----------------------------------
        // Find Task
        //----------------------------------

        const task = await CampaignTask.findOne({
            _id: taskId,
            campaign: campaignId,
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found in this campaign.",
            });
        }

        //----------------------------------
        // Find Participant
        //----------------------------------

        const participant = await CampaignParticipant.findOne({
            campaign: campaignId,
            user: userId,
        });

        if (!participant) {
            return res.status(403).json({
                success: false,
                message: "You must join this campaign before submitting a task.",
            });
        }

        //----------------------------------
        // Validate Submission
        //----------------------------------

        const text = submission.text?.trim() || "";
        const url = submission.url?.trim() || "";
        const screenshot = submission.screenshot?.trim() || "";
        const wallet = submission.wallet?.trim() || "";

        const requirements = campaign.requirements || {};

        // if (requirements.submissionUrlRequired && !url) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "A submission URL is required.",
        //     });
        // }

        // if (requirements.screenshotRequired && !screenshot) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "A screenshot is required.",
        //     });
        // }

        // if (requirements.walletRequired && !wallet) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "A wallet address is required.",
        //     });
        // }

        //----------------------------------
        // Check Existing Submission
        //----------------------------------

        // const existingSubmission = await CampaignSubmission.findOne({
        //     campaign: campaignId,
        //     task: taskId,
        //     user: userId,
        // });

        // if (existingSubmission) {

        //     if (requirements.oneSubmissionPerUser) {
        //         return res.status(400).json({
        //             success: false,
        //             message: "You have already submitted this task.",
        //             submission: existingSubmission,
        //         });
        //     }
        // }

        //----------------------------------
        // Check Wallet Submission
        //----------------------------------

        if (
            wallet &&
            requirements.oneSubmissionPerWallet
        ) {

            const walletSubmission =
                await CampaignSubmission.findOne({
                    campaign: campaignId,
                    task: taskId,
                    "submission.wallet": wallet,
                });

            if (walletSubmission) {
                return res.status(400).json({
                    success: false,
                    message: "This wallet has already submitted this task.",
                });
            }
        }


        const duplicateSubmission = await CampaignSubmission.findOne({
            campaign: campaignId,
            task: taskId,
            user: userId,
            "submission.url": url,
        });

        if (duplicateSubmission) {
            return res.status(400).json({
                success: false,
                message: "You have already submitted this link for this task.",
                submission: duplicateSubmission,
            });
        }


        //----------------------------------
        // Create Submission
        //----------------------------------

        const newSubmission =
            await CampaignSubmission.create({

                campaign: campaignId,

                task: taskId,

                participant: participant._id,

                user: userId,

                submission: {
                    text,
                    url,
                    screenshot,
                    wallet,
                },

                status: "pending",

            });

        //----------------------------------
        // Update Campaign Stats
        //----------------------------------

        await Campaign.findByIdAndUpdate(
            campaignId,
            {
                $inc: {
                    "stats.submissions": 1,
                },
            }
        );

        //----------------------------------
        // Success
        //----------------------------------

        return res.status(201).json({
            success: true,
            message: "Task submitted successfully.",
            submission: newSubmission,
        });

    } catch (error) {

        console.error("Submit Task Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to submit task.",
        });

    }
});






module.exports = router;