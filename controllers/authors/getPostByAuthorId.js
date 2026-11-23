const { Author, Post } = require("../../models");
const mongoose = require("mongoose");

const getPostByAuthorId = async (req, res) => {
  const { id } = req.params;
  // ✅ check author ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      code: 400,
      message: "Invalid author id",
    });
  }
  try {
    //find author by author id
    const author = await Author.findById(id).select("name").lean();

    if (!author) {
      return res.status(404).json({
        code: 404,
        message: "Author not found",
      });
    }
    // find post by author name author.name
    const posts = await Post.find({ author: author.name })
      .sort({
        createdAt: -1,
      })
      .lean();
    //if author hasn't any pots
    if (posts.length === 0) {
      return res.json({
        status: "success",
        code: 200,
        posts,
        meta: {
          total: posts.length,
          hasPosts: posts.length > 0,
          message: `author ${author.name} hasn't any post`,
        },
      });
    }

    res.json({
      status: "success",
      code: 200,
      posts,
    });
  } catch (error) {
    console.log("Errror in getPostByAuthorId controller:", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

module.exports = getPostByAuthorId;
