const cloudinary = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploads = async (filePath, folder, context = {}) => {
  try {
    const result = await cloudinary.uploader.upload(
      filePath,
      {
        folder,
        use_filename: true,
        unique_filename: false,
        overwrite: true,
        resource_type: "auto",
      },
      {
        context, // 👈 тут Cloudinary сохраняет alt/caption/description
        resource_type: "auto",
        folder: folder,
      }
    );
    return {
      url: result.secure_url,
      id: result.public_id,
      context: result.context?.custom || {}, // возвращаем что Cloudinary сохранил
    };
  } catch (err) {
    console.error("❌ Cloudinary upload error:", err);
    return null; // чтобы Promise.all не падал
  }
};

exports.remove = async (id) => {
  try {
    const result = await cloudinary.uploader.destroy(id);
    return result;
  } catch (err) {
    console.error("❌ Cloudinary delete error:", err);
    return null;
  }
};

// Separate from the legacy upload path: never replace an existing public ID.
exports.uploadArticleMedia = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "Blog-YPB",
    public_id: require("node:crypto").randomUUID(),
    resource_type: "image",
    overwrite: false,
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  });
  return { url: result.secure_url, id: result.public_id };
};
