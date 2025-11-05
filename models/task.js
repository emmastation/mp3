const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Task name is required']
  },
  description: {
    type: String,
    default: ''
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required']
  },
  completed: {
    type: Boolean,
    default: false
  },
  // user _id as string
  assignedUser: {
    type: String,
    default: ''
  },
  assignedUserName: {
    type: String,
    default: 'unassigned'
  },
  // set automatically by server
  dateCreated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Task', TaskSchema);
