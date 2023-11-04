const { Post } = require("../../models");

const getPostByArticleUrl = async (req, res) => {
  const { articleUrl } = req.query;
  const result = await Post.findOne({ articleUrl });
  console.log("work");
  console.log({ result });

  if (!result) {
    return res
      .status(409)
      .json({
        code: 409,
        message: `posts with url ${articleUrl} don't found in DB`,
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

module.exports = getPostByArticleUrl;
