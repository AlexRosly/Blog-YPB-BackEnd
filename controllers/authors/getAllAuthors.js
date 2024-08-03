const { Author } = require("../../models");

const getAllAuthors = async (req, res) => {
  try {
    const result = await Author.find();

    res
      .status(200)
      .json({
        status: "success",
        code: 200,
        result,
      })
      .end();
  } catch (error) {
    console.log("Errror in getAllAuthors controller:", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

module.exports = getAllAuthors;
