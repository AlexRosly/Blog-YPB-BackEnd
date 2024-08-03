const { Author } = require("../../models");

const getAuthorPhoto = async (req, res) => {
  const { id } = req.params;
  try {
    const { image } = await Author.findById(id);
    res

      .json({
        status: "success",
        code: 200,
        image,
      })
      .end();
  } catch (error) {
    console.log("Errror in getAllAuthors controller:", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

module.exports = getAuthorPhoto;
