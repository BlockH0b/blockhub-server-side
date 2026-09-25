const mongoose = require("mongoose");

const CohortTutor = require("../models/CohortTutor");
const jwt = require("jsonwebtoken");
const expree = require("express");
const router = expree.Router();
const CohortClass = require("../models/CohortClass");
const CohortRegistration = require("../models/Cohort");
const User = require("../models/user");
const requireCohortTutor = require("../middlewave/requireCohortTutor");




/*
|--------------------------------------------------------------------------
| ALL ROUTES BELOW REQUIRE COHORT TUTOR ACCESS
|--------------------------------------------------------------------------
*/

router.use(requireCohortTutor);


/*
|--------------------------------------------------------------------------
| GET TUTOR DASHBOARD
|--------------------------------------------------------------------------
*/

router.get("/dashboard", async (req, res) => {
  try {
    const tutor = req.cohortTutor;

    const user = req.user;

    const cohort = tutor.cohort;

    const track = tutor.track;

    /*
     * ------------------------------------------------------
     * GET CLASSES
     * ------------------------------------------------------
     */

    const classes = await CohortClass.find({
      cohort,
      track,
      tutor: user._id,
    })
      .sort({
        startDate: 1,
      })
      .lean();

    /*
     * ------------------------------------------------------
     * GET STUDENTS
     * ------------------------------------------------------
     */

    const registrations =
      await CohortRegistration.find({
        cohort,
        track,
      })
        .sort({
          registeredAt: -1,
        })
        .lean();

    const studentIds = registrations
      .map((registration) => registration.user)
      .filter(Boolean);

    const students = await User.find({
      _id: {
        $in: studentIds,
      },
    })
      .select(
        "_id fullName email profileImage"
      )
      .lean();

    const studentMap = new Map(
      students.map((student) => [
        student._id.toString(),
        student,
      ])
    );

    const formattedStudents = registrations.map(
      (registration) => {
        const student = studentMap.get(
          registration.user?.toString()
        );

        return {
          id: registration.user?.toString(),

          fullName:
            student?.fullName ||
            registration.fullName,

          email:
            student?.email ||
            registration.email,

          profileImage:
            student?.profileImage || null,

          track: registration.track,

          progress: 0,

          completedClasses: 0,

          totalClasses: classes.filter(
            (item) => item.status !== "cancelled"
          ).length,

          attendance: 0,

          registrationStatus:
            registration.status,

          registeredAt:
            registration.registeredAt,
        };
      }
    );

    /*
     * ------------------------------------------------------
     * FORMAT CLASSES
     * ------------------------------------------------------
     */

    const formattedClasses = classes.map(
      (classItem) => ({
        id: classItem._id.toString(),

        title: classItem.title,

        description:
          classItem.description || null,

        classNumber:
          classItem.classNumber || 0,

        date: classItem.startDate,

        startTime:
          classItem.startTime,

        endTime:
          classItem.endTime || null,

        durationMinutes:
          classItem.durationMinutes || null,

        duration: formatDuration(
          classItem.durationMinutes
        ),

        meetingLink:
          classItem.meetingStatus === "available"
            ? classItem.meetingLink
            : null,

        meetingStatus:
          classItem.meetingStatus,

        status: mapClassStatus(
          classItem
        ),
      })
    );

    /*
     * ------------------------------------------------------
     * STATISTICS
     * ------------------------------------------------------
     */

    const activeClasses =
      formattedClasses.filter(
        (item) => item.status !== "cancelled"
      );

    const upcomingClasses =
      formattedClasses.filter(
        (item) =>
          item.status === "upcoming" ||
          item.status === "live"
      );

    const completedClasses =
      formattedClasses.filter(
        (item) => item.status === "completed"
      );

    const stats = {
      totalStudents:
        formattedStudents.length,

      totalClasses:
        activeClasses.length,

      upcomingClasses:
        upcomingClasses.length,

      completedClasses:
        completedClasses.length,
    };

    /*
     * ------------------------------------------------------
     * RETURN
     * ------------------------------------------------------
     */

    return res.status(200).json({
      success: true,

      data: {
        tutor: {
          id: tutor._id.toString(),

          userId: user._id.toString(),

          fullName:
            user.fullName || null,

          email:
            user.email || null,

          profileImage:
            user.profileImage || null,

          bio:
            tutor.bio || "",

          cohort:
            tutor.cohort,

          track:
            tutor.track,

          tutorLevel:
            tutor.tutorLevel,

          tutorCode:
            tutor.tutorCode || null,

          skills:
            tutor.skills || [],

          communityLink:
            tutor.communityLink || null,

          curriculumLink:
            tutor.curriculumLink || null,

          scheduleLink:
            tutor.scheduleLink || null,

          status:
            tutor.status,
        },

        stats,

        classes:
          formattedClasses,

        students:
          formattedStudents,

        announcements: [],
      },
    });
  } catch (error) {
    console.error(
      "getDashboard error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load tutor dashboard.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET MY PROFILE
|--------------------------------------------------------------------------
*/

router.get("/profile", async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        tutor: req.cohortTutor,
        user: req.user,
      },
    });
  } catch (error) {
    console.error(
      "getProfile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load tutor profile.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/

router.put("/profile", async (req, res) => {
  try {
    const {
      bio,
      skills,
      communityLink,
      curriculumLink,
      scheduleLink,
    } = req.body;

    const tutor =
      await CohortTutor.findById(
        req.cohortTutor._id
      );

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message:
          "Cohort tutor profile not found.",
      });
    }

    if (bio !== undefined) {
      tutor.bio = bio;
    }

    if (skills !== undefined) {
      tutor.skills = Array.isArray(skills)
        ? skills
        : tutor.skills;
    }

    if (communityLink !== undefined) {
      tutor.communityLink =
        communityLink || null;
    }

    if (curriculumLink !== undefined) {
      tutor.curriculumLink =
        curriculumLink || null;
    }

    if (scheduleLink !== undefined) {
      tutor.scheduleLink =
        scheduleLink || null;
    }

    await tutor.save();

    return res.status(200).json({
      success: true,
      message:
        "Tutor profile updated successfully.",
      data: tutor,
    });
  } catch (error) {
    console.error(
      "updateProfile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update tutor profile.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE CLASS
|--------------------------------------------------------------------------
*/

router.post("/classes", async (req, res) => {
  try {
    const {
      title,
      description,
      classNumber,
      startDate,
      startTime,
      endTime,
      durationMinutes,
      meetingLink,
    } = req.body;

    /*
     * ------------------------------------------------------
     * VALIDATION
     * ------------------------------------------------------
     */

    if (
      !title ||
      !startDate ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title, date, start time and end time are required.",
      });
    }

    /*
     * ------------------------------------------------------
     * CHECK DUPLICATE CLASS NUMBER
     * ------------------------------------------------------
     */

    if (classNumber) {
      const existingClass =
        await CohortClass.findOne({
          cohort: req.cohort,
          track: req.track,
          classNumber: Number(
            classNumber
          ),
          status: {
            $ne: "cancelled",
          },
        });

      if (existingClass) {
        return res.status(409).json({
          success: false,
          message:
            "A class with this class number already exists.",
        });
      }
    }

    /*
     * ------------------------------------------------------
     * CREATE CLASS
     * ------------------------------------------------------
     *
     * IMPORTANT:
     *
     * tutor
     * cohort
     * track
     * createdBy
     *
     * COME FROM MIDDLEWARE.
     *
     * NOT FROM req.body.
     */

    const newClass =
      await CohortClass.create({
        cohort: req.cohort,

        track: req.track,

        tutor: req.user._id,

        createdBy: req.user._id,

        title: title.trim(),

        description:
          description?.trim() || null,

        classNumber: classNumber
          ? Number(classNumber)
          : null,

        startDate: new Date(startDate),

        startTime,

        endTime,

        durationMinutes:
          durationMinutes
            ? Number(durationMinutes)
            : null,

        meetingLink:
          meetingLink?.trim() || null,

        meetingStatus:
          meetingLink?.trim()
            ? "available"
            : "pending",

        status: "scheduled",
      });

    return res.status(201).json({
      success: true,
      message:
        "Class created successfully.",
      data: newClass,
    });
  } catch (error) {
    console.error(
      "createClass error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create class.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE CLASS
|--------------------------------------------------------------------------
*/

router.put("/classes/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID.",
      });
    }

    const classItem =
      await CohortClass.findOne({
        _id: id,

        tutor: req.user._id,

        cohort: req.cohort,

        track: req.track,
      });

    if (!classItem) {
      return res.status(404).json({
        success: false,
        message:
          "Class not found or you do not have permission to edit it.",
      });
    }

    const {
      title,
      description,
      classNumber,
      startDate,
      startTime,
      endTime,
      durationMinutes,
      meetingLink,
      status,
    } = req.body;

    if (title !== undefined) {
      classItem.title = title.trim();
    }

    if (description !== undefined) {
      classItem.description =
        description?.trim() || null;
    }

    if (classNumber !== undefined) {
      classItem.classNumber =
        classNumber
          ? Number(classNumber)
          : null;
    }

    if (startDate !== undefined) {
      classItem.startDate =
        new Date(startDate);
    }

    if (startTime !== undefined) {
      classItem.startTime =
        startTime;
    }

    if (endTime !== undefined) {
      classItem.endTime =
        endTime;
    }

    if (durationMinutes !== undefined) {
      classItem.durationMinutes =
        durationMinutes
          ? Number(durationMinutes)
          : null;
    }

    if (meetingLink !== undefined) {
      classItem.meetingLink =
        meetingLink?.trim() || null;

      classItem.meetingStatus =
        meetingLink?.trim()
          ? "available"
          : "pending";
    }

    if (status !== undefined) {
      const allowedStatuses = [
        "scheduled",
        "ongoing",
        "completed",
        "cancelled",
      ];

      if (
        allowedStatuses.includes(status)
      ) {
        classItem.status = status;
      }
    }

    await classItem.save();

    return res.status(200).json({
      success: true,
      message:
        "Class updated successfully.",
      data: classItem,
    });
  } catch (error) {
    console.error(
      "updateClass error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update class.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE CLASS
|--------------------------------------------------------------------------
*/

router.delete("/classes/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID.",
      });
    }

    const classItem =
      await CohortClass.findOne({
        _id: id,

        tutor: req.user._id,

        cohort: req.cohort,

        track: req.track,
      });

    if (!classItem) {
      return res.status(404).json({
        success: false,
        message:
          "Class not found or access denied.",
      });
    }

    /*
     * Instead of physically deleting it,
     * mark it cancelled.
     *
     * This is safer because students may
     * already have seen the class.
     */

    classItem.status = "cancelled";

    await classItem.save();

    return res.status(200).json({
      success: true,
      message:
        "Class cancelled successfully.",
    });
  } catch (error) {
    console.error(
      "deleteClass error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to cancel class.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET STUDENTS
|--------------------------------------------------------------------------
*/

router.get("/students", async (req, res) => {
  try {
    const registrations =
      await CohortRegistration.find({
        cohort: req.cohort,
        track: req.track,
      })
        .sort({
          registeredAt: -1,
        })
        .lean();

    const userIds = registrations
      .map((item) => item.user)
      .filter(Boolean);

    const users = await User.find({
      _id: {
        $in: userIds,
      },
    })
      .select(
        "_id fullName email profileImage"
      )
      .lean();

    const userMap = new Map(
      users.map((user) => [
        user._id.toString(),
        user,
      ])
    );

    const data = registrations.map(
      (registration) => {
        const user = userMap.get(
          registration.user?.toString()
        );

        return {
          id:
            registration.user?.toString(),

          fullName:
            user?.fullName ||
            registration.fullName,

          email:
            user?.email ||
            registration.email,

          profileImage:
            user?.profileImage || null,

          track:
            registration.track,

          status:
            registration.status,

          progress: 0,

          attendance: 0,

          registeredAt:
            registration.registeredAt,
        };
      }
    );

    return res.status(200).json({
      success: true,

      data,
    });
  } catch (error) {
    console.error(
      "getStudents error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load students.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| UPDATE CURRICULUM LINK
| PATCH /cohort-tutor/curriculum
|
| Lets a tutor set/update the Google Doc/Drive link where they've
| written their curriculum. Separate from the general profile update
| so the tutor UI can offer a simple, single-field "paste your link"
| box instead of the full profile form.
|--------------------------------------------------------------------------
*/

router.patch("/curriculum", async (req, res) => {
  try {
    const { curriculumLink } = req.body;

    if (
      curriculumLink !== null &&
      curriculumLink !== undefined &&
      curriculumLink.trim() !== ""
    ) {
      const trimmedLink = curriculumLink.trim();

      /*
       * ------------------------------------------------------
       * VALIDATE URL FORMAT
       * ------------------------------------------------------
       */

      let parsedUrl;

      try {
        parsedUrl = new URL(trimmedLink);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid link.",
        });
      }

      if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
      ) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid link.",
        });
      }

      /*
       * ------------------------------------------------------
       * OPTIONAL: RESTRICT TO GOOGLE LINKS ONLY
       * ------------------------------------------------------
       *
       * Since the whole point is "a Google file link", this
       * blocks anything that isn't Docs/Sheets/Slides/Drive.
       * Remove this block if you'd rather accept any URL.
       */

      const allowedHosts = [
        "docs.google.com",
        "drive.google.com",
        "sheets.google.com",
      ];

      const isGoogleLink = allowedHosts.some((host) =>
        parsedUrl.hostname.includes(host)
      );

      if (!isGoogleLink) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide a Google Docs, Sheets, or Drive link.",
        });
      }

      var finalLink = trimmedLink;
    } else {
      // Allow clearing the link by sending an empty string/null
      var finalLink = null;
    }

    /*
     * ------------------------------------------------------
     * SAVE
     * ------------------------------------------------------
     */

    const tutor = await CohortTutor.findById(
      req.cohortTutor._id
    );

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Cohort tutor profile not found.",
      });
    }

    tutor.curriculumLink = finalLink;

    await tutor.save();

    return res.status(200).json({
      success: true,
      message: finalLink
        ? "Curriculum link updated successfully."
        : "Curriculum link removed.",
      data: {
        curriculumLink: tutor.curriculumLink,
      },
    });
  } catch (error) {
    console.error("updateCurriculumLink error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update curriculum link.",
    });
  }
});


function formatDuration(minutes) {
  if (!minutes) return null;

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  const remaining = minutes % 60;

  if (!remaining) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remaining} min`;
}

function mapClassStatus(classItem) {
  if (classItem.status === "cancelled") {
    return "cancelled";
  }

  if (classItem.status === "completed") {
    return "completed";
  }

  if (classItem.status === "ongoing") {
    return "live";
  }

  const now = new Date();

  const classDate = new Date(
    classItem.startDate
  );

  if (classDate > now) {
    return "upcoming";
  }

  return "completed";
}

module.exports = router;