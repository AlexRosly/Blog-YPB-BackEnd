const { Schema, model } = require("mongoose");

const postSchema = Schema(
  {
    title: {
      type: String,
    },
    author: {
      type: String,
    },
    heading: { type: String },
    imageUrl: [{ type: String }],
    description: {
      type: String,
    },
    publicationDate: {
      type: Date,
    },
    changeDate: {
      type: Date,
    },
    articleUrl: {
      type: String,
    },
    markup: {
      type: String,
    },
    country: { type: String },
  },
  { versionKey: false, timestamps: true }
);

const Post = model("post", postSchema);

module.exports = Post;
