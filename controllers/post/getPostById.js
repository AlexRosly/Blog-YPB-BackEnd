const { Post } = require("../../models");

const getPostById = async (req, res) => {
  const { id } = req.query;

  const result = await Post.find({ _id: id });

  if (!result) {
    return res
      .status(409)
      .json({
        code: 409,
        message: `posts with id ${id} don't found in DB`,
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

module.exports = getPostById;
