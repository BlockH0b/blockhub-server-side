const User = require("../models/user");
const Ambassador = require("../models/Ambassadors");
const ProjectAmbassador = require("../models/projectAmbassador");

const logoutAll = async (req, res) => {
  try {
    await User.updateMany({}, { $inc: { tokenVersion: 1 } });
    await Ambassador.updateMany({}, { $inc: { tokenVersion: 1 } });
    await ProjectAmbassador.updateMany({}, { $inc: { tokenVersion: 1 } });

    return res.status(200).json({
      success: true,
      message: "✅ All tokens invalidated. Everyone must log in again.",
    });
  } catch (err) {
    console.error("Logout-all error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { logoutAll };
