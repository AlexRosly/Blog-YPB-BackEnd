const { Post } = require("../../models");
const cloudinary = require("../../utils/cloudinary");
const path = require("path");
const fs = require("fs").promises;
const cyrillicToTranslit = require("cyrillic-to-translit-js");
const langdetect = require("langdetect");

const addPost = async (req, res) => {
  const { title, author, description, markup, titleForLink } = req.body;

  const domain = "https://www.thewandered.com/";

  const language = langdetect.detectOne(`${titleForLink}`);

  let verifyTitle;
  if (titleForLink) {
    verifyTitle = titleForLink.replace(/[.,:'"?!\-]/g, "");
  }

  const translit = cyrillicToTranslit({ preset: language })
    .transform(verifyTitle, "-")
    .toLowerCase();
  const articleUrl = `${domain}${translit}`;

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
        title,
        author,
        description,
        publicationDate,
        markup,
        changeDate,
        imageUrl: urls,
        articleUrl,
      });

      if (!result) {
        return res
          .status(404)
          .json({
            code: 404,
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
      return res
        .status(405)
        .json({
          err: `${req.method} method not allowed`,
        })
        .end();
    }
  } catch (error) {
    return res
      .status(404)
      .json({
        code: 404,
        message: "post don't created",
      })
      .end();
  }

  res.end();
};

module.exports = addPost;
