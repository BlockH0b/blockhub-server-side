const mongoose = require('mongoose')

const projectAmbassadorSchema = new mongoose.Schema({
    ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    totalPoints: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
}, { collection: 'project_ambassadors' })

module.exports = mongoose.model('ProjectAmbassador', projectAmbassadorSchema)
