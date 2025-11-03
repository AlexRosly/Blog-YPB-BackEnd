const { Post } = require("../../models");

const getAllPosts = async (req, res) => {
  const { limit, page = 1, typeOfPage = "home" } = req.query;

  let result;
  let total;

  if (!limit) {
    total = await Post.find({ country: typeOfPage }).count();
    result = await Post.find(
      { country: typeOfPage },
      {
        title: 1,
        author: 1,
        imageUrl: 1,
        heading: 1,
        description: 1,
        markup: 1,
        articleUrl: 1,
        publicationDate: 1,
        country: 1,
      }
    );
  } else {
    const skip = (page - 1) * limit;
    total = await Post.find({ country: typeOfPage }).count();
    result = await Post.find(
      { country: typeOfPage },
      {
        title: 1,
        author: 1,
        imageUrl: 1,
        heading: 1,
        description: 1,
        markup: 1,
        articleUrl: 1,
        publicationDate: 1,
        country: 1,
      },
      { skip, limit: Number(limit) }
    ).sort({ createdAt: -1 });
  }

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
      total,
    })
    .end();
};

module.exports = getAllPosts;
