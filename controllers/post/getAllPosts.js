const { Post } = require("../../models");

const getAllPosts = async (req, res) => {
  const { limit = 3, page = 1 } = req.query;
  const skip = (page - 1) * limit;
  const result = await Post.find(
    {},
    {
      title: 1,
      author: 1,
      imageUrl: 1,
      description: 1,
      markup: 1,
      articleUrl: 1,
      publicationDate: 1,
    },
    { skip, limit: Number(limit) }
  ).sort({ createdAt: -1 });

  if (!result) {
    return res
      .status(404)
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
