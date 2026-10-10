const express = require("express");
const router = express.Router();

const getAdzunaJobs = require("../services/jobs/adzuna");
const getRemotiveJobs = require("../services/jobs/remotive");
const getJSearchJobs = require("../services/jobs/jsearch");

router.get("/jobs", async (req, res) => {
  try {
    const query = req.query.q || "web3";

    const [adzuna, remotive, jsearch] = await Promise.all([
      getAdzunaJobs(query),
      getRemotiveJobs(query),
      getJSearchJobs(query),
    ]);

    const allJobs = [...jsearch, ...remotive, ...adzuna];

    return res.json({
      success: true,
      count: allJobs.length,
      data: allJobs,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch jobs",
    });
  }
});

module.exports = router;