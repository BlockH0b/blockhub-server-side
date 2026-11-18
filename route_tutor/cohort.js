const mongoose = require("mongoose");

const CohortTutor = require("../models/CohortTutor");
const jwt = require("jsonwebtoken");
const express = require("express");
const router = express.Router();
const CohortClass = require("../models/CohortClass");
const CohortRegistration = require("../models/Cohort");
const User = require("../models/user");
const requireCohortTutor = require("../middlewave/requireCohortTutor");
const CohortAnnouncement = require("../models/CohortAnnouncement");
const { getClassStartsAt, getClassEndsAt } = require("../utils/classTime");
const { getLiveSessionMap } = require("../services/liveClass.helpers");
const notify = require("../services/email/notify");
const googleMeet = require("../services/googleMeet.service");
const { cleanMeetLink } = require("../utils/meetLink");
const { renumberSoon } = require("../utils/classNumbers");
const { formatExtraLinks } = require("../utils/classLinks");

/*
|--------------------------------------------------------------------------
| GOOGLE MEET HELPERS
|--------------------------------------------------------------------------
| The BlockHub Google account hosts every class. These never throw: a
| Google problem must not stop a class being saved - the tutor gets a
| warning and can paste a link instead.
*/

function meetDetails(classItem, tutor) {
  return {
    title: classItem.title,
    description: classItem.description,
    startsAt: getClassStartsAt(classItem),
    endsAt: getClassEndsAt(classItem),
    tutorEmail: tutor?.email || null,
    track: classItem.track,
  };
}

async function attachGoogleMeet(classItem, tutor) {
  try {
    if (!(await googleMeet.isConnected())) {
      return "Class saved, but no Google Meet link was made: Google Meet isn't connected yet. Ask an admin to connect it on the admin page, or paste a link.";
    }
    const meeting = await googleMeet.createMeeting(meetDetails(classItem, tutor));
    classItem.meetingLink = meeting.meetLink;
    classItem.meetingStatus = "available";
    classItem.meetSource = "google";
    classItem.googleEventId = meeting.eventId;
    await classItem.save();
    return null;
  } catch (error) {
    console.error("[tutor] google meet create failed:", error.message);
    return `Class saved, but the Google Meet link couldn't be made. ${error.message}`;
  }
}

async function updateGoogleMeet(classItem, tutor) {
  try {
    if (!classItem.googleEventId) return null;
    await googleMeet.updateMeeting(classItem.googleEventId, meetDetails(classItem, tutor));
    return null;
  } catch (error) {
    console.error("[tutor] google meet update failed:", error.message);
    return `Class saved, but Google Meet wasn't updated. ${error.message}`;
  }
}

async function cancelGoogleMeet(classItem) {
  try {
    if (!classItem.googleEventId) return null;
    await googleMeet.cancelMeeting(classItem.googleEventId);
    return null;
  } catch (error) {
    console.error("[tutor] google meet cancel failed:", error.message);
    return `Class cancelled, but the Google Meet event couldn't be removed. ${error.message}`;
  }
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}




/*
|--------------------------------------------------------------------------
| ALL ROUTES BELOW REQUIRE COHORT TUTOR ACCESS
|--------------------------------------------------------------------------
*/

router.use(requireCohortTutor);

// After any class is created / moved / deleted, keep numbers 1, 2, 3...
router.use((req, res, next) => {
  if (req.method !== "GET" && /^\/classes/.test(req.path)) {
    res.on("finish", () => {
      if (res.statusCode < 400) renumberSoon(req.cohort, req.track);
    });
  }
  next();
});


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
      // Every class of this track (classes made from the admin timetable
      // belong to the track, not to one tutor)
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

    const liveSessionMap = await getLiveSessionMap(
      classes.map((classItem) => classItem._id)
    );

    const announcements = await CohortAnnouncement.find({
      cohort,
      track,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formattedClasses = classes.map(
      (classItem) => ({
        id: classItem._id.toString(),

        startsAt: getClassStartsAt(classItem),

        endsAt: getClassEndsAt(classItem),

        liveSession:
          liveSessionMap[classItem._id.toString()] || null,

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

        meetSource:
          classItem.meetSource || null,

        recordingLink:
          classItem.recordingLink || null,

        // Part 2 / Part 3 links
        extraLinks: formatExtraLinks(classItem),

        emailStudents:
          classItem.emailStudents !== false,

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

        announcements: announcements.map(formatAnnouncement),
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

    try {
      req.body.meetingLink = cleanMeetLink(meetingLink);
    } catch (linkError) {
      return res.status(400).json({ success: false, message: linkError.message });
    }

    /*
     * ------------------------------------------------------
     * CHECK DUPLICATE CLASS NUMBER
     * ------------------------------------------------------
     */

    // Class numbers are now set automatically (utils/classNumbers.js)
    if (false && classNumber) {
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
          req.body.meetingLink,

        meetingStatus:
          req.body.meetingLink
            ? "available"
            : "pending",

        meetSource:
          req.body.meetingLink
            ? "manual"
            : null,

        status: "scheduled",

        // Untick "Email students" for test classes -> no emails at all
        emailStudents: req.body?.emailStudents !== false,
      });

    /*
     * Google Meet: made automatically on the BlockHub Google account,
     * unless the tutor pasted their own link or unticked it.
     */

    let meetWarning = null;

    // Only when the tutor ticks "Create a Google Meet link for me".
    // Normally the tutor makes the meeting in Google Meet and pastes the link.
    if (!newClass.meetingLink && req.body?.autoMeet === true) {
      meetWarning = await attachGoogleMeet(newClass, req.user);
    }

    notify.classScheduled(newClass);

    return res.status(201).json({
      success: true,
      message: meetWarning
        ? meetWarning
        : newClass.meetSource === "google"
          ? "Class created with a Google Meet link."
          : "Class created successfully.",
      meetWarning,
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

const updateClassHandler = async (req, res) => {
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

        // any class of the tutor's own track (incl. timetable classes)
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
      status,
      emailStudents,
      recordingLink,
      autoMeet,
    } = req.body;

    let meetingLink = req.body.meetingLink;
    if (meetingLink !== undefined) {
      try {
        meetingLink = cleanMeetLink(meetingLink);
      } catch (linkError) {
        return res.status(400).json({ success: false, message: linkError.message });
      }
    }

    const previousTitle = classItem.title;
    const previousLink =
      classItem.meetingStatus === "available" ? classItem.meetingLink || null : null;
    const previousDescription = classItem.description;
    const previousEndsAt = getClassEndsAt(classItem);
    let meetWarning = null;

    if (typeof emailStudents === "boolean") {
      classItem.emailStudents = emailStudents;
    }

    // remember the old time/status so we can email students about changes
    const previousStartsAt = getClassStartsAt(classItem);
    const previousStatus = classItem.status;

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

    if (
      meetingLink !== undefined &&
      (cleanUrl(meetingLink) || null) !== (classItem.meetingLink || null)
    ) {
      // Tutor replaced (or removed) the link by hand: drop the
      // BlockHub Google Meet event if there was one.
      if (classItem.googleEventId) {
        meetWarning = await cancelGoogleMeet(classItem);
        classItem.googleEventId = null;
      }

      classItem.meetingLink = cleanUrl(meetingLink);

      classItem.meetingStatus =
        classItem.meetingLink
          ? "available"
          : "pending";

      classItem.meetSource =
        classItem.meetingLink
          ? "manual"
          : null;
    }

    if (recordingLink !== undefined) {
      classItem.recordingLink = cleanUrl(recordingLink);
    }

    // First person to work on a timetable class becomes its tutor
    if (!classItem.tutor) {
      classItem.tutor = req.user._id;
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

    const newStartsAt = getClassStartsAt(classItem);
    const newEndsAt = getClassEndsAt(classItem);

    /*
     * Keep the Google Meet event in step with the class
     */

    if (classItem.status === "cancelled") {
      if (previousStatus !== "cancelled" && classItem.googleEventId) {
        meetWarning = await cancelGoogleMeet(classItem);
        classItem.googleEventId = null;
        await classItem.save();
      }
    } else if (classItem.googleEventId) {
      const changed =
        previousTitle !== classItem.title ||
        (previousDescription || null) !== (classItem.description || null) ||
        previousStartsAt?.getTime() !== newStartsAt?.getTime() ||
        previousEndsAt?.getTime() !== newEndsAt?.getTime();

      if (changed) {
        meetWarning = await updateGoogleMeet(classItem, req.user);
      }
    } else if (autoMeet === true && !classItem.meetingLink) {
      // "Create a Google Meet link" on a class that has none yet
      meetWarning = await attachGoogleMeet(classItem, req.user);
    }

    // New / changed Google Meet link -> email every student in the track
    const newLink =
      classItem.meetingStatus === "available" ? classItem.meetingLink || null : null;

    if (newLink && newLink !== previousLink && classItem.status !== "cancelled") {
      notify.classLinkReady(classItem, { changed: Boolean(previousLink) });
    }

    if (classItem.status === "cancelled" && previousStatus !== "cancelled") {
      notify.classCancelled(classItem);
    } else if (
      classItem.status !== "cancelled" &&
      previousStartsAt &&
      newStartsAt &&
      previousStartsAt.getTime() !== newStartsAt.getTime()
    ) {
      notify.classUpdated(classItem, previousStartsAt);
    }

    return res.status(200).json({
      success: true,
      message:
        meetWarning || "Class updated successfully.",
      meetWarning,
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
};

router.put("/classes/:id", updateClassHandler);
// The dashboard sends PATCH - accept both.
router.patch("/classes/:id", updateClassHandler);

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

    const wasCancelled = classItem.status === "cancelled";

    classItem.status = "cancelled";

    const meetWarning = await cancelGoogleMeet(classItem);

    if (!meetWarning) classItem.googleEventId = null;

    await classItem.save();

    if (!wasCancelled) notify.classCancelled(classItem);

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

      const isGoogleLink = allowedHosts.some(
        (host) =>
          parsedUrl.hostname === host ||
          parsedUrl.hostname.endsWith(`.${host}`)
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


/*
|--------------------------------------------------------------------------
| ANNOUNCEMENTS
|--------------------------------------------------------------------------
| Shown on the dashboard of every student in this tutor's track.
*/

const ANNOUNCEMENT_TYPES = ["info", "important", "success"];

function readAnnouncementBody(body = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const type = ANNOUNCEMENT_TYPES.includes(body.type) ? body.type : "info";
  return { title, message, type };
}

router.get("/announcements", async (req, res) => {
  try {
    const items = await CohortAnnouncement.find({
      cohort: req.cohort,
      track: req.track,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      data: items.map(formatAnnouncement),
    });
  } catch (error) {
    console.error("listAnnouncements error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load announcements.",
    });
  }
});

router.post("/announcements", async (req, res) => {
  try {
    const { title, message, type } = readAnnouncementBody(req.body);

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required.",
      });
    }

    const item = await CohortAnnouncement.create({
      cohort: req.cohort,
      track: req.track,
      title: title.slice(0, 160),
      message: message.slice(0, 4000),
      type,
      author: req.user._id,
    });

    notify.announcementPosted(item, req.user);

    return res.status(201).json({
      success: true,
      message: "Announcement posted.",
      data: formatAnnouncement(item),
    });
  } catch (error) {
    console.error("createAnnouncement error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to post announcement.",
    });
  }
});

const updateAnnouncementHandler = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID.",
      });
    }

    const item = await CohortAnnouncement.findOne({
      _id: id,
      cohort: req.cohort,
      track: req.track,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    const { title, message, type } = readAnnouncementBody({
      title: req.body?.title ?? item.title,
      message: req.body?.message ?? item.message,
      type: req.body?.type ?? item.type,
    });

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required.",
      });
    }

    item.title = title.slice(0, 160);
    item.message = message.slice(0, 4000);
    item.type = type;
    await item.save();

    return res.status(200).json({
      success: true,
      message: "Announcement updated.",
      data: formatAnnouncement(item),
    });
  } catch (error) {
    console.error("updateAnnouncement error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update announcement.",
    });
  }
};

router.patch("/announcements/:id", updateAnnouncementHandler);
router.put("/announcements/:id", updateAnnouncementHandler);

router.delete("/announcements/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID.",
      });
    }

    const result = await CohortAnnouncement.deleteOne({
      _id: id,
      cohort: req.cohort,
      track: req.track,
    });

    if (!result.deletedCount) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement deleted.",
    });
  } catch (error) {
    console.error("deleteAnnouncement error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete announcement.",
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

  // Use the real start/end moment (date + time), not midnight.
  const endsAt = getClassEndsAt(classItem);

  if (endsAt && endsAt < new Date()) {
    return "completed";
  }

  return "upcoming";
}

function formatAnnouncement(item) {
  return {
    id: item._id.toString(),
    title: item.title,
    message: item.message,
    type: item.type || "info",
    createdAt: item.createdAt,
  };
}

module.exports = router;
