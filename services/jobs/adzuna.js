const axios = require("axios");

const stripHtml = (text = "") => text.replace(/<[^>]*>/g, "");

const getAdzunaJobs = async (query = "web3") => {
  const { data } = await axios.get(
    "https://api.adzuna.com/v1/api/jobs/us/search/1",
    {
      params: {
        app_id: process.env.ADZUNA_ID,
        app_key: process.env.ADZUNA_KEY,
        what: query,
      },
    }
  );

  return data.results.map(job => ({
    title: job.title || "Untitled Role",
    company: job.company?.display_name || "Unknown Company",

    location: job.location?.display_name || "Unknown",

    description: (stripHtml(job.description || "")).slice(0, 250),

    applyLink: job.redirect_url || null,

    logo: null,

    salary:
      job.salary_min && job.salary_max
        ? `$${job.salary_min} - $${job.salary_max}`
        : job.salary_is_predicted
        ? "Estimated salary"
        : null,

    source: "adzuna",
  }));
};

module.exports = getAdzunaJobs;