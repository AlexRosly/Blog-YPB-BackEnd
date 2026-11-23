const { Post } = require("../../models");

const updateDb = async (req, res) => {
  try {
    const posts = await Post.find();

    for (const post of posts) {
      post.imageUrl = post.imageUrl.map((img) =>
        typeof img === "string"
          ? { url: img, id: null, context: { alt: null, caption: null } }
          : img
      );

      await post.save();
    }
    res.status(200).json({
      code: 200,
      status: "success",
      posts,
    });
  } catch (error) {
    console.error("Error in cancelDidntArriveAsPerContract controller:", error);
    return res.status(500).json({
      code: 500,
      status: "error",
      message: "Internal server error",
    });
  }
};
module.exports = updateDb;
