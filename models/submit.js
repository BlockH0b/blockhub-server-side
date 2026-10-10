const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },

  proof: String, // link or text proof (like Twitter/X link)
  hashtag: String,

  proofImages: [
    {
      public_id: { type: String },  // For deleting or managing the image later
      url: { type: String },        // The secure_url for display in frontend
    },
  ],

  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submitted_at: { type: Date, default: Date.now }
}, { collection: 'submissions' });

module.exports = mongoose.model('Submission', submissionSchema);
