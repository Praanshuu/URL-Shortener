const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const urlSchema = new mongoose.Schema({
  shortId: {
    type: String, 
    unique: true, 
    required: true,
    default: () => nanoid(8)
  },
  redirectURL: {
    type: String,
    required: true,
  },
  visitHistory: [ { timestamp: {type: Number} } ]
},
  { timestamps: true }
);

const URL = mongoose.model('Url', urlSchema);

module.exports = URL;
