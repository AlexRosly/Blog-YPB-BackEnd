const express = require("express");
const { post: ctrl } = require("../controllers");
const { ctrlWrapper, upload } = require("../middelwares");
const router = express.Router();

//get all post
router.get("/get-all", ctrlWrapper(ctrl.getAllPosts));

//get post from url
router.get("/get-by-url", ctrlWrapper(ctrl.getPostByArticleUrl));

//get post by id
router.get("/get-post-by-id", ctrlWrapper(ctrl.getPostById));

//get post by search query
router.get("/search-query", ctrlWrapper(ctrl.autoComplete));

//create post
router.post("/add-post", upload.array("image"), ctrlWrapper(ctrl.addPost));

router.patch("/update-post/:id", ctrlWrapper(ctrl.updatePost));

module.exports = router;
