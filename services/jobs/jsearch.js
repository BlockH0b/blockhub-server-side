require("dotenv").config();
const axios = require("axios");

const getJSearchJobs = async () => {
  try {
    const response = await axios.get(
      "https://jsearch.p.rapidapi.com/search",
      {
        params: { query: "web3" },
        headers: {
          "X-RapidAPI-Key": process.env.RAPID_API_KEY,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      }
    );


    


    return response.data.data.map(job => ({
      title: job.job_title || "Untitled Role",
      company: job.employer_name || "Unknown Company",
      location: job.job_is_remote
        ? "Remote"
        : job.job_location || "Unknown",

      description: (job.job_description || "")
        .replace(/<[^>]+>/g, "")
        .slice(0, 250),

      applyLink:
        job.job_apply_link ||
        job.job_google_link ||
        null,

      logo: job.employer_logo || null,
      salary: job.job_salary_string || null,
      source: "jsearch",
    }));
  } catch (error) {
    console.error("JSearch Error:", error.response?.data || error.message);
    return [];
  }
};

module.exports = getJSearchJobs 