const axios = require("axios");

const countryApi = async (langCode) => {
  const url = `http://ypbooking.chost.com.ua/api/countries?langCode=${langCode}`;

  try {
    const response = await axios.get(url);
    const data = response.data;
    return data.data;
  } catch (error) {
    console.log({ error });
    return [];
  }
};

module.exports = countryApi;
