const multer = require("multer-article-media");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "../temp"),
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: 512000, files: 12, fields: 6, parts: 18, fieldSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return cb(null, true);
    return cb(Object.assign(new Error("Unsupported photo format."), { status: 400 }));
  },
});

const multipart = upload.array("image", 12);
module.exports = (req, res, next) => {
  if (!req.is("multipart/form-data")) return res.status(415).json({ message: "Expected multipart/form-data." });
  return multipart(req, res, (err) => {
    if (!err) return next();
    const status = err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FIELD_VALUE" ? 413 : 400;
    return res.status(status).json({ message: "Invalid photo upload. Use JPG, PNG or WebP up to 500 KB." });
  });
};
