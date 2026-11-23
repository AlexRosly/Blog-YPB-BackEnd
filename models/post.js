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
    imageUrl: [
      {
        url: String,
        id: String,
        context: {
          alt: String,
          caption: String,
        },
      },
    ],
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
    country: { type: String, required: true },
  },
  { versionKey: false, timestamps: true }
);

const Post = model("post", postSchema);

module.exports = Post;
