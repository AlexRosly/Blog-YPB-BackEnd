const { Post } = require("../../models");

const getAllPosts = async (req, res) => {
  const { limit = 3, page = 1 } = req.query;
  const skip = (page - 1) * limit;
  const result = await Post.find(
    {},
    { title: 1, author: 1, imageUrl: 1, description: 1, articleUrl: 1 },
    { skip, limit: Number(limit) }
  );

  if (!result) {
    return res
      .status(204)
      .json({
        code: 404,
        message: "posts don't found in DB",
      })
      .end();
  }
  res
    .status(200)
    .json({
      status: "success",
      code: 200,
      result,
    })
    .end();
};

module.exports = getAllPosts;
