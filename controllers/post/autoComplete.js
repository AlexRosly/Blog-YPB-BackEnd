const { Post } = require("../../models");

const autoComplete = async ({ query: { search, limit = 8 } }, res) => {
  const searchFromUrl = decodeURI(search).trim();
  //   const findDescription = await Post.find({
  //     description: { $regex: searchFromUrl, $options: "i" },
  //     // markup: { $regex: searchFromUrl, $options: "i" },
  //   }).limit(limit);

  //   const findMarkup = await Post.find({
  //     // description: { $regex: searchFromUrl, $options: "i" },
  //     markup: { $regex: searchFromUrl, $options: "i" },
  //   }).limit(limit);
  const result = await Post.find({
    $or: [
      { description: { $regex: searchFromUrl, $options: "i" } },
      { markup: { $regex: searchFromUrl, $options: "i" } },
    ],
  });

  if (result.length === 0) {
    return res
      .json({
        status: "error",
        code: 404,
        message: `${search} not found in DB`,
      })
      .end();
  }

  res.json({
    status: "success",
    code: 200,
    result,
  });
  res.end();
};

module.exports = autoComplete;
