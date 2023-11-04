const express = require("express");
const { blogs: ctrl } = require("../controllers");
const { ctrlWrapper, validation, upload } = require("../middelwares");
const router = express.Router();

//get all post
router.get("/get-all", ctrlWrapper(ctrl.getAllPosts));

//get post from url
router.get("/get-by-url", ctrlWrapper(ctrl.getPostByArticleUrl));

//create post
router.post("/add-post", upload.array("image"), ctrlWrapper(ctrl.addPost));

module.exports = router;
