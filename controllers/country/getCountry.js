const countryApi = require("../../utils/countryApi");

const getCountry = async (req, res) => {
  try {
    const { langCode } = req.query;
    const getAllCountry = await countryApi(langCode || "EN");

    //if country wasn't found
    if (getAllCountry.length === 0) {
      return res.status(404).json({
        code: 404,
        status: "error",
        message: "Country wasn't found",
      });
    }
    const filtered = getAllCountry.countries.map(
      ({ international, country, langCode }) => ({
        international,
        country,
        langCode,
      })
    );

    res.status(200).json({
      code: 200,
      status: "success",
      country: filtered,
    });
  } catch (error) {
    console.error("Error in getCountry controller:", error);
    return res.status(500).json({
      code: 500,
      status: "error",
      message: "Internal server error",
    });
  }
};

module.exports = getCountry;
