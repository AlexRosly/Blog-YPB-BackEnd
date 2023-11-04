const { Post } = require("../../models");
const cloudinary = require("../../utils/cloudinary");
const path = require("path");
const fs = require("fs").promises;

const addPost = async (req, res) => {
  const { articleUrl } = req.body;
  const findPost = await Post.find({ articleUrl });

  if (findPost.length > 0) {
    return res
      .status(409)
      .json({
        code: 409,
        message: `article with url ${articleUrl} are exist in DB`,
      })
      .end();
  }

  try {
    const uploader = async (path) => await cloudinary.uploads(path, "Blog-YPB");
    if (req.method === "POST") {
      const urls = [];
      const files = req.files;
      for (const file of files) {
        const { path } = file;
        const newPath = await uploader(path);
        urls.push(newPath);
        await fs.unlink(path);
      }

      const publicationDate = new Date();
      const changeDate = new Date();

      const result = await Post.create({
        ...req.body,
        publicationDate,
        changeDate,
        imageUrl: urls,
      });
      if (!result) {
        return res
          .status(409)
          .json({
            code: 409,
            message: "post don't created",
          })
          .end();
      }
      res
        .status(201)
        .json({
          status: "success",
          code: 201,
          result,
        })
        .end();
    } else {
      res
        .status(405)
        .json({
          err: `${req.method} method not allowed`,
        })
        .end();
    }
  } catch (error) {
    console.log({ error });
    return res
      .status(404)
      .json({
        code: 404,
        message: "post don't created",
      })
      .end();
  }

  // console.log({ result });

  res.end();
};

module.exports = addPost;
