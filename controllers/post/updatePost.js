const { Post } = require("../../models");
const { NotFound } = require("http-errors");

const updatePost = async (req, res) => {
  const { id } = req.params;
  const { title, description, markup } = req.body;
  console.log({ id });

  const result = await Post.findByIdAndUpdate(
    id,
    { title, description, markup },
    {
      new: true,
    }
  );
  // const udatePost = await Post.updateOne(
  //   { _id: id },
  //   { $set: { title, description, markup } }
  // );

  if (!result) {
    throw new NotFound(
      `we can't update posts, because posts with ${id} not found`
    );
  }
  // const result = await Post.find({ id });

  res.json({
    status: "success",
    code: 200,
    data: {
      result,
    },
  });
};

module.exports = updatePost;
