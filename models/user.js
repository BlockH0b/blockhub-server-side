const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName:                   { type: String },
    twitterHandle:              { type: String, unique: true,sparse: true, trim: true },
    twitterId:                  { type: String, unique: true, sparse: true, trim: true},
    email:                      { type: String, default: null },
    profileImage:               { type: String, default: null },
    verified:                   { type: Boolean, default: false },
    followersCount:             { type: Number, default: 0 },
    followingCount:             { type: Number, default: 0 },
    tweetCount:                 { type: Number, default: 0 },

    bio:                        { type: String, default: null },

    points:                     { type: Number, default: 0 },
    total_points:               { type: Number, default: 0 },
    level:                      { type: String, default: 'Beginner' },
    tasks_completed:            { type: Number, default: 0 },

    grindFi:                    { 
                                    reputation:           { type: Number, default: 0},
                                    totalProjectsCreated: {type: Number, default: 0}, 
                                    totalCampaignsJoined: {type: Number, default: 0}, 
                                    totalCampaignsCreated:{type: Number, default: 0}, 
                                    totalRewardsEarned:   {type: Number, default: 0},
                                    activeCampaigns: { type: Number, default: 0 }, 
                                    totalTasksCompleted:  {type: Number, default: 0}, 
                                },      

    referralCode:               {
                                    type: String,
                                    unique: true,
                                    sparse: true,
                                    uppercase: true,
                                    trim: true,
                                    index: true,
                                },  

    template_bought:            { type: Boolean, default: false },
    portfolio:                  { type: Boolean, default: false },
    portfolioUrl:               [{ type: String, default: '' }],
    portfolioPublicId:          [{ type: String, default: '' }],
    portfolioNames:             [{ type: String, default: '' }],

    interest:                   [{ type: String, required: true }],
    isVerified:                 { type: Boolean, default: false },


    isSeller:                   { type: Boolean,default: false, },

    sellerProfile:              { type: mongoose.Schema.Types.ObjectId,ref: "sellers",},

    isTutor:                    { type: Boolean, default: false }, // NEW: quick flag
    tutorProfile:               { type: mongoose.Schema.Types.ObjectId, ref: 'tutors' },

    walletAddress:              {type: String,default: null, },
    nairaAccount:               {
                                    accountNumber:  { type: String, default: null, },
                                    accountName:    { type: String, default: null, },
                                    bankName:       { type: String, default: null, },
                                    bankCode:       { type: String, default: null, },
                                    recipientCode:  { type: String, default: null, },
                                    recipientId:    { type: Number,default: null,  },
                                    verified:       { type: Boolean, default: false, },
                                    activatedAt:    { type: Date, default: null, },
                                    updatedAt:      { type: Date,default: null,},
                                },
    totalPurchases:             {type: Number,default: 0,},

    totalSpent:                 {type: Number,default: 0,},

    source:                     { type: String, default: 'website' }, // track login source

    admin:                      { type: Boolean, default: false }, // NEW: admin flag

    createdAt:                  { type: Date, default: Date.now },
    savedJobs:                  [{ type: mongoose.Schema.Types.ObjectId, ref: 'jobs' }],
    appliedJobs:                [{ type: mongoose.Schema.Types.ObjectId, ref: 'jobs' }],
    isCohortTutor:              { type: Boolean, default: false, },

cohortTutorProfile:             { type: mongoose.Schema.Types.ObjectId, ref: "CohortTutor", default: null, },

    emailSent:                  { type: Boolean, default: false },

    // ---------- Email (see services/email) ----------
    emailVerified:              { type: Boolean, default: false },
    emailVerifiedAt:            { type: Date, default: null },
    welcomeEmailSentAt:         { type: Date, default: null },
    // true = receive, false = unsubscribed. Receipts, security and
    // verification emails are always sent regardless of these.
    emailPreferences:           {
                                    classUpdates:   { type: Boolean, default: true },  // classes, reminders, live now
                                    announcements:  { type: Boolean, default: true },  // tutor announcements
                                    campaigns:      { type: Boolean, default: true },  // GrindFi campaigns
                                    learning:       { type: Boolean, default: true },  // academy courses, nudges
                                    sales:          { type: Boolean, default: true },  // seller / tutor sale alerts
                                    referrals:      { type: Boolean, default: true },
                                    digest:         { type: Boolean, default: true },  // weekly digest
                                },
    unsubscribedAll:            { type: Boolean, default: false },

    telegram:                   {
                                    id: { type: String, unique: true, sparse: true },
                                    username: { type: String, default: null },
                                    firstName: { type: String, default: null },
                                    linkedAt: { type: Date, default: null }
                                }
}, {
    timestamps: true,
    collection: 'users'
});


module.exports = mongoose.models.users || mongoose.model('users', userSchema);