const { timingSafeEqual } = require("node:crypto");
const { parseFragment } = require("parse5");

const MAX_INLINE = 50;
const MAX_UPLOADS = 12;
const invalid = (message) => Object.assign(new Error(message), { status: 400 });
const record = (value) => !!value && typeof value === "object" && !Array.isArray(value);

const gatewayKey = () => {
  const key = process.env.BLOG_MEDIA_GATEWAY_SECRET;
  return process.env.BLOG_EXISTING_ARTICLE_MEDIA === "true" && key?.length >= 32
    ? Buffer.from(key)
    : null;
};
const enabled = () => Boolean(gatewayKey());
const requireMediaAdmin = (req, res, next) => {
  const expected = gatewayKey();
  if (!expected) return res.status(404).json({ message: "Article media editing is not enabled." });
  const actual = Buffer.from(req.get("X-Blog-Media-Gateway") || "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return res.status(403).json({ message: "Article media editing requires admin authorization." });
  }
  next();
};

const cleanContext = ({ alt, caption } = {}, requireAlt = false) => {
  if (typeof alt !== "string" || typeof caption !== "string" ||
      alt.length > 300 || caption.length > 1000 || (requireAlt && !alt.trim())) {
    throw invalid("Check the alt text and caption for each image.");
  }
  return { alt: alt.trim(), caption: caption.trim() };
};

function imageSlots(html) {
  if (typeof html !== "string" || Buffer.byteLength(html) > 2 * 1024 * 1024) throw invalid("Invalid article body.");
  const slots = [];
  function visit(node) {
    if (node.tagName === "img") {
      const attr = node.attrs.find((a) => a.name === "src");
      const range = node.sourceCodeLocation?.attrs?.src;
      if (!attr?.value || !range) throw invalid("Every image must have a source.");
      slots.push({ src: attr.value, start: range.startOffset, end: range.endOffset });
    }
    (node.childNodes || []).forEach(visit);
  }
  visit(parseFragment(html, { sourceCodeLocationInfo: true }));
  return slots;
}

function validPhotoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function buildPlan(post, markup, manifest, files) {
  const assets = post.imageUrl || [];
  const previous = imageSlots(post.markup || "");
  if (!assets.length || previous.length !== assets.length - 1 ||
      !assets.every((photo) => validPhotoUrl(photo.url))) {
    throw invalid("This article’s existing photos cannot be safely matched. No changes were saved.");
  }
  const slots = imageSlots(markup);
  if (!record(manifest) || !record(manifest.cover) || !Array.isArray(manifest.inline) ||
      slots.length !== manifest.inline.length || slots.length > MAX_INLINE ||
      files.length > MAX_UPLOADS || slots.length !== previous.length + files.length) {
    throw invalid("The article has an invalid photo list.");
  }
  const cover = cleanContext(manifest.cover);
  const oldIndices = new Set();
  const uploadIndices = new Set();
  const inline = manifest.inline.map((item, index) => {
    const slot = slots[index];
    if (!record(item) || item.src !== slot.src) throw invalid("The images do not match their positions in the article.");
    if (Object.hasOwn(item, "existing") && !Object.hasOwn(item, "upload")) {
      const i = item.existing;
      if (!Number.isInteger(i) || i < 1 || i >= assets.length || oldIndices.has(i) ||
          (slot.src !== assets[i].url && slot.src !== previous[i - 1].src)) {
        throw invalid("An existing image does not match the original article.");
      }
      oldIndices.add(i);
      return { existing: i };
    }
    if (Object.hasOwn(item, "upload") && !Object.hasOwn(item, "existing")) {
      const i = item.upload;
      if (!Number.isInteger(i) || i < 0 || i >= files.length || uploadIndices.has(i) || !slot.src.startsWith("blob:")) {
        throw invalid("An uploaded image does not match the article body.");
      }
      uploadIndices.add(i);
      return { upload: i, context: cleanContext(item, true) };
    }
    throw invalid("Unknown article image.");
  });
  return { assets, cover, inline, slots };
}
const escapeAttr = (url) => url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function bindMedia(plan, markup, uploads) {
  const [cover] = plan.assets;
  const copy = (photo) => typeof photo.toObject === "function" ? photo.toObject() : { ...photo };
  const imageUrl = [
    { ...copy(cover), context: plan.cover },
    ...plan.inline.map((item) => item.existing
      ? copy(plan.assets[item.existing])
      : { ...uploads[item.upload], context: item.context }),
  ];
  for (let i = plan.slots.length - 1; i >= 0; i--) {
    const { start, end } = plan.slots[i];
    markup = markup.slice(0, start) + `src="${escapeAttr(imageUrl[i + 1].url)}"` + markup.slice(end);
  }
  return { markup, imageUrl };
}

module.exports = { enabled, requireMediaAdmin, buildPlan, bindMedia, validPhotoUrl, MAX_UPLOADS };
