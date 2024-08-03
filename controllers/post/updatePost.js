const { Post } = require("../../models");
// const { NotFound } = require("http-errors");

const updatePost = async (req, res) => {
  const { id } = req.params;
  const { title, description, markup, author } = req.body;

  const result = await Post.findByIdAndUpdate(
    id,
    { title, description, markup, author },
    {
      new: true,
    }
  );

  if (!result) {
    return res.json({
      status: "error",
      code: 404,
      message: `we can't update posts, because posts with ${id} not found`,
    });
    // throw new NotFound(
    //   `we can't update posts, because posts with ${id} not found`
    // );
  }

  res.json({
    status: "success",
    code: 200,
    data: {
      result,
    },
  });
};

module.exports = updatePost;
