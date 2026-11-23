const { Author } = require("../../models");
const cloudinary = require("../../utils/cloudinary");
const fs = require("fs").promises;

function errorResponse(code, message) {
  return { code, status: "error", message };
}

function avatarUrl(upload) {
  const value = typeof upload?.url === "string" ? upload.url.trim() : "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

async function createAuthor(body, filePath) {
  const { description, name, skills, links, email } = body || {};
  if (typeof name !== "string" || !name.trim()) {
    return errorResponse(400, "An author name is required.");
  }

  let image;
  try {
    image = avatarUrl(await cloudinary.uploads(filePath, "Blog-YPB-Author"));
  } catch (error) {
    console.error("Author photo upload failed:", error?.code || error?.name);
  }
  if (!image) return errorResponse(502, "Author photo upload failed.");

  const result = await Author.create({
    description,
    image,
    name: name.trim(),
    skills,
    links,
    email,
  });
  if (!result) return errorResponse(500, "Author could not be created.");
  return { status: "success", code: 201, result };
}

module.exports = async function addAuthor(req, res) {
  const filePath = req.file?.path;
  if (typeof filePath !== "string" || !filePath) {
    return res.status(400).json(errorResponse(400, "An author photo is required."));
  }

  let response;
  try {
    response = await createAuthor(req.body, filePath);
  } catch (error) {
    console.error("Author creation failed:", error?.code || error?.name);
    response = errorResponse(500, "Author could not be created.");
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Cleanup is best effort. Never turn a committed create into a retryable error.
      if (error?.code !== "ENOENT") {
        console.error("Author temporary upload cleanup failed:", error?.code || error?.name);
      }
    }
  }
  return res.status(response.code).json(response);
};
