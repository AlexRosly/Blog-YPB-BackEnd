const getAllPosts = require("./getAllPosts");
const addPost = require("./addPost");
const getPostByArticleUrl = require("./getPostByArticleUrl");
const updatePost = require("./updatePost");
const getPostById = require("./getPostById");
const autoComplete = require("./autoComplete");
const updateDb = require("./updateDb");

module.exports = {
  getAllPosts,
  addPost,
  getPostByArticleUrl,
  updatePost,
  getPostById,
  autoComplete,
  updateDb,
};
