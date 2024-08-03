const express = require("express");
const { author: ctrl } = require("../controllers");
const { ctrlWrapper, upload } = require("../middelwares");
const router = express.Router();

//add author
router.post("/add-author", upload.single("image"), ctrlWrapper(ctrl.addAuthor));
router.get("/get-all-authors", ctrlWrapper(ctrl.getAllAuthors));
router.get("/get-author-photo/:id", ctrlWrapper(ctrl.getAuthorPhoto));

module.exports = router;
