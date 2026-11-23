const { Post } = require("../../models");
const cloudinary = require("../../utils/cloudinary");
const fs = require("fs").promises;
const cyrillicToTranslit = require("cyrillic-to-translit-js");
const langdetect = require("langdetect");
const { customArticleUrl } = require("../../utils/customArticleSlug");

// Prevent overlapping creates of the same URL within this API process.
const pendingArticleUrls = new Set();

const addPost = async (req, res) => {
  const files = req.files || [];
  let reservedUrl;
  try {
    const {
      title,
      author,
      description,
      markup,
      heading,
      country,
      alts,
      captions,
      slug,
    } = req.body;

    const custom = customArticleUrl(slug, country);
    if (custom.error) {
      return res.status(custom.error).json({ code: custom.error, message: custom.message });
    }

    let articleUrl = custom.url;
    if (!articleUrl) {
      const domain = "https://www.thewandered.com/";
      const language = langdetect.detectOne(`${heading || "en"}`);
      const verifyTitle = heading?.replace(/[.,:'"?!\-]/g, "") || "post";
      const translit = cyrillicToTranslit({ preset: language })
        .transform(verifyTitle, "-")
        .toLowerCase();
      articleUrl = country
        ? `${domain}${country.toLowerCase()}/${translit}`
        : `${domain}${translit}`;
    }

    if (pendingArticleUrls.has(articleUrl)) {
      return res.status(409).json({
        code: 409,
        message: `Article with URL ${articleUrl} is already being created.`,
      });
    }
    pendingArticleUrls.add(articleUrl);
    reservedUrl = articleUrl;

    const exists = await Post.exists({ articleUrl });
    if (exists) {
      return res.status(409).json({
        code: 409,
        message: `Article with URL ${articleUrl} already exists.`,
      });
    }

    // --- Upload files in Cloudinary ---
    if (!files.length) {
      return res.status(400).json({
        code: 400,
        message: "No images uploaded.",
      });
    }
    // Upload all photos in parallel
    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const context = {
          alt: alts?.[index] || "No alt provided",
          caption: captions?.[index] || "",
          // description: photoDescriptions?.[index] || "",
        };
        // console.log("➡️ Uploading with context:", context);

        const result = await cloudinary.uploads(file.path, "Blog-YPB", context);

        if (!result) {
          console.warn(`⚠️ Upload failed for ${file.originalname}`);
          return null;
        }

        return result;
      })
    );

    // remove empty elements (if some upload didn't work)
    const successfulUploads = uploads.filter((u) => u !== null);

    // console.log("✅ Uploads completed:", successfulUploads);
    // --- Save post ---
    const now = new Date();
    const newPost = await Post.create({
      title,
      author,
      description,
      markup,
      heading,
      country: country?.toLowerCase() || "home",
      publicationDate: now,
      changeDate: now,
      articleUrl,
      imageUrl: successfulUploads, // array with descriptions and url
    });

    return res.status(201).json({
      code: 201,
      status: "success",
      data: newPost,
    });
  } catch (error) {
    console.error("Error creating post:", error);
    return res.status(500).json({
      code: 500,
      status: "error",
      message: "Post creation failed",
    });
  } finally {
    if (reservedUrl) pendingArticleUrls.delete(reservedUrl);
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
  }
};

module.exports = addPost;
