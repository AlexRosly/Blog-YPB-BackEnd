const express = require("express");
const { country: ctrl } = require("../controllers");
const { ctrlWrapper } = require("../middelwares");
const router = express.Router();

//add author
router.get("/get-country", ctrlWrapper(ctrl.getCountry));

module.exports = router;
