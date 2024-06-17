const express = require("express");
const { author: ctrl } = require("../controllers");
const { ctrlWrapper, validation, upload } = require("../middelwares");
const router = express.Router();

//add author
router.post("/add-author", upload.single("image"), ctrlWrapper(ctrl.addAuthor));

module.exports = router;