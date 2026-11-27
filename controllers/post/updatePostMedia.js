const { unlink } = require("node:fs/promises");
const { Post } = require("../../models");
const cloudinary = require("../../utils/cloudinary");
const { buildPlan, bindMedia, validPhotoUrl } = require("../../utils/existingArticleMedia");

const conflict = (res) => res.status(409).json({ message: "The article changed. Keep a copy of your edits and reload before retrying." });

async function updatePostMedia(req, res) {
  const files = req.files || [];
  const uploads = [];
  let writeAttempted = false;
  let definitelyUncommitted = false;
  try {
    const { id } = req.params;
    const { revision, media, markup, title, description, author } = req.body;
    const rev = new Date(typeof revision === "string" ? revision : NaN);
    let manifest;
    try { manifest = JSON.parse(media); } catch { /* Malformed manifest. */ }
    if (!/^[0-9a-f]{24}$/i.test(id) || !Number.isFinite(rev.getTime()) ||
        revision !== rev.toISOString() || !manifest ||
        ![title, description, author].every((value) => typeof value === "string")) {
      return res.status(400).json({ message: "Invalid article media edit." });
    }
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Article not found." });
    if (post.updatedAt?.getTime() !== rev.getTime()) return conflict(res);

    const plan = buildPlan(post, markup, manifest, files);
    for (const item of plan.inline) {
      if (!Object.hasOwn(item, "upload")) continue;
      const photo = await cloudinary.uploadArticleMedia(files[item.upload].path);
      if (photo?.id) uploads[item.upload] = photo;
      if (!photo?.id || !validPhotoUrl(photo.url)) {
        return res.status(502).json({ message: "A photo upload failed. The article was not changed." });
      }
    }

    const bound = bindMedia(plan, markup, uploads);
    writeAttempted = true;
    const result = await Post.findOneAndUpdate(
      { _id: id, updatedAt: rev },
      { $set: { title, description, author, ...bound, changeDate: new Date() } },
      { new: true, runValidators: true }
    );
    if (!result) {
      definitelyUncommitted = true;
      return conflict(res);
    }
    return res.json({ status: "success", code: 200, data: { result } });
  } finally {
    // After an ambiguous database error the write may be committed. Never
    // delete newly attached media in that case; clean up only known failures.
    if (!writeAttempted || definitelyUncommitted) {
      await Promise.all(uploads.map((p) => Promise.resolve().then(() => cloudinary.remove(p.id)).catch(() => {})));
    }
    await Promise.all(files.map((f) => unlink(f.path).catch(() => {})));
  }
}
module.exports = updatePostMedia;
