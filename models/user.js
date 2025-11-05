const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'User name is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true
  },
  // store task _id as strings
  pendingTasks: {
    type: [String],
    default: []
  },
  // set automatically by server
  dateCreated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
