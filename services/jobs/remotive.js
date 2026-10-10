const axios = require("axios");

const stripHtml = (text = "") => text.replace(/<[^>]*>/g, "");

const getRemotiveJobs = async (query = "developer") => {
  const { data } = await axios.get(
    `https://remotive.com/api/remote-jobs?search=${query}`
  );

  return data.jobs.map(job => ({
    title: job.title || "Untitled Role",
    company: job.company_name || "Unknown Company",
    location: "Remote",

    description: (stripHtml(job.description || "")).slice(0, 250),

    applyLink: job.url || null,

    logo: job.company_logo || null,

    salary: job.salary || null,

    source: "remotive",
  }));
};

module.exports = getRemotiveJobs;