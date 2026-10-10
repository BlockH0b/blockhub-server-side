route.post('/saved-applied-status', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: "Token required" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('savedJobs appliedJobs');

        return res.status(200).json({
            saved: user.savedJobs,
            applied: user.appliedJobs
        });
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token', error: err.message });
    }
});


route.get('/filters-data', async (req, res) => {
    try {
        const jobTypes = await Job.distinct('jobType');
        const skills = await Job.distinct('importantSkills');
        const areas = await Job.distinct('areaFocused');

        return res.status(200).json({ jobTypes, skills, areas });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load filters', error: err.message });
    }
});


route.post('/search-jobs', async (req, res) => {
    const { token, keyword, skills, jobType, status, page = 1, limit = 10 } = req.body;

    try {
        const query = {};

        if (keyword) {
            query.title = { $regex: keyword, $options: 'i' }; // case-insensitive
        }

        if (skills?.length) {
            query.importantSkills = { $in: skills };
        }

        if (jobType) {
            query.jobType = jobType;
        }

        if (status) {
            query.status = status;
        }

        // Only show jobs within application period
        const now = new Date();
        query.applicationStart = { $lte: now };
        query.applicationEnd = { $gte: now };

        const jobs = await Job.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Job.countDocuments(query);

        return res.status(200).json({ jobs, total, page });
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
});
