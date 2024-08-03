const { Author } = require("../../models");
const cloudinary = require("../../utils/cloudinary");
const path = require("path");
const fs = require("fs").promises;

const addAuthor = async (req, res) => {
  //get params from req.body
  const { description, name, skills, links, email } = req.body;
  //get file
  const { path } = req.file;

  try {
    //save image in cloudinary
    const uploader = async (path) =>
      await cloudinary.uploads(path, "Blog-YPB-Author");
    //save author in DB
    const result = await Author.create({
      description,
      image: await uploader(path),
      name,
      skills,
      links,
      email,
    });
    //if authron doesn't created return reponse
    if (!result) {
      //delete photo
      await fs.unlink(path);
      return res
        .status(404)
        .json({
          code: 404,
          message: "author don't created",
        })
        .end();
    }
    //delete photo
    await fs.unlink(path);
    //retunr response
    res
      .status(201)
      .json({
        status: "success",
        code: 201,
        result,
      })
      .end();
  } catch (error) {
    console.log("Errror in getMessages addAuthor:", error.message);
    res.status(500).json({ error: "internal server error" }).end();
  }
};
module.exports = addAuthor;
