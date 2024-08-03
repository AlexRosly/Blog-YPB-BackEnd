const { Schema, model } = require("mongoose");

const authorSchema = Schema(
  {
    description: {
      type: String,
    },
    image: {
      type: String,
    },
    name: { type: String },
    email: { type: String },
    skills: {
      type: String,
    },
    links: [],
  },
  { versionKey: false, timestamps: true }
);

const Author = model("authors", authorSchema);

module.exports = Author;
