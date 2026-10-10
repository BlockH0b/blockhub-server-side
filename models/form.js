const mongoose = require("mongoose");

const AcademyStudentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },

  // Web2
  web2Skills: [{ type: String }],
  web2Other: { type: String },
  web2Project: { type: String },
  web2Rating: { type: Number },

  // Web3
  web3Interests: [{ type: String }],
  web3Other: { type: String },
  web3Experience: { type: String },

  // Learning Fit
  learningSpeed: { type: String },
  hoursPerWeek: { type: Number },
  learningPreference: { type: String },
  web3Goal: { type: String },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AcademyStudent", AcademyStudentSchema);
