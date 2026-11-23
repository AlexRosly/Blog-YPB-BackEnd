const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const picture = "https://res.cloudinary.com/example/image/upload/author.jpg";
const uploadResult = { url: picture, id: "author/photo", context: {} };

function load(relativePath, modules, console) {
  const filename = path.join(__dirname, "..", relativePath);
  const module = { exports: {} };
  vm.compileFunction(fs.readFileSync(filename, "utf8"), ["require", "module", "console"], {
    filename,
  })((name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  }, module, console);
  return module.exports;
}

function fixture(overrides = {}) {
  const calls = { upload: [], create: [], unlink: [], logs: [] };
  const output = { error: (...args) => calls.logs.push(args) };
  const addAuthor = load("controllers/authors/addAuthor.js", {
    "../../models": { Author: { async create(body) {
      calls.create.push(body);
      return overrides.create ? overrides.create(body) : { _id: "synthetic-author", ...body };
    } } },
    "../../utils/cloudinary": { async uploads(...args) {
      calls.upload.push(args);
      return overrides.upload ? overrides.upload(...args) : uploadResult;
    } },
    fs: { promises: { async unlink(file) {
      calls.unlink.push(file);
      return overrides.unlink ? overrides.unlink(file) : fs.promises.unlink(file);
    } } },
  }, output);
  const ctrlWrapper = load("middelwares/ctrlWrapper.js", {}, output);
  const registered = {};
  load("routes/author.js", {
    express: { Router: () => ({
      post(route, ...handlers) { registered[route] = handlers; },
      get() {},
    }) },
    "../controllers": { author: { addAuthor } },
    "../middelwares": { ctrlWrapper, upload: { single: (field) => field } },
  }, output);

  const [field, handler] = registered["/add-author"];
  assert.equal(field, "image");
  const invoke = async (body, filePath) => {
    const res = {
      status(code) { this.code = code; return this; },
      json(value) {
        assert.equal(this.body, undefined, "Send exactly one response");
        assert.equal(value.code, this.code);
        this.body = value;
        return this;
      },
    };
    const req = { body, file: filePath === undefined ? undefined : { path: filePath } };
    await handler(req, res, (error) => assert.fail(`Escaped route handler: ${error}`));
    return res;
  };
  return { calls, invoke };
}

async function tempFile(t) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "blog-author-test-"));
  t.after(() => fs.promises.rm(dir, { force: true, recursive: true }));
  const file = path.join(dir, "synthetic.jpg");
  await fs.promises.writeFile(file, "synthetic upload");
  return file;
}

test("missing multipart photo returns 400 without side effects", async () => {
  const { calls, invoke } = fixture();
  const res = await invoke({ name: "Synthetic Author" });
  assert.deepEqual(res.body, { code: 400, status: "error", message: "An author photo is required." });
  assert.deepEqual(calls, { upload: [], create: [], unlink: [], logs: [] });
});

test("missing name returns 400 and deletes the uploaded temp file", async (t) => {
  const file = await tempFile(t);
  const { calls, invoke } = fixture();
  const res = await invoke({ name: " " }, file);
  assert.equal(res.code, 400);
  assert.deepEqual(calls.upload, []);
  assert.deepEqual(calls.create, []);
  assert.deepEqual(calls.unlink, [file]);
  assert.equal(fs.existsSync(file), false);
});

test("Cloudinary object writes only its URL and returns the backward-compatible 201", async (t) => {
  const file = await tempFile(t);
  const { calls, invoke } = fixture();
  const fields = {
    name: "Synthetic Author",
    email: "",
    description: "Contributor bio",
    skills: "Writing",
    links: '[{"xsolid":"https://example.test/name"}]',
  };
  const res = await invoke({ ...fields, name: ` ${fields.name} ` }, file);
  assert.deepEqual(calls.upload, [[file, "Blog-YPB-Author"]]);
  assert.deepEqual(calls.create, [{ ...fields, image: picture }]);
  assert.deepEqual(res.body, {
    status: "success", code: 201, result: { _id: "synthetic-author", ...fields, image: picture },
  });
  assert.deepEqual(calls.unlink, [file]);
  assert.equal(fs.existsSync(file), false);
});

for (const [caseName, upload] of [
  ["null result", async () => null],
  ["missing URL", async () => ({ id: "upload-without-url" })],
  ["unsafe URL", async () => ({ url: "javascript:placeholder" })],
  ["upstream error", async () => { throw new Error("Synthetic upload error"); }],
]) {
  test(`photo upload ${caseName} returns 502 and does not write an author`, async (t) => {
    const file = await tempFile(t);
    const { calls, invoke } = fixture({ upload });
    const res = await invoke({ name: "Synthetic Author" }, file);
    assert.deepEqual(res.body, { code: 502, status: "error", message: "Author photo upload failed." });
    assert.deepEqual(calls.create, []);
    assert.deepEqual(calls.unlink, [file]);
    assert.equal(fs.existsSync(file), false);
  });
}

test("database failure returns a generic 500 and cleans up the temp file", async (t) => {
  const file = await tempFile(t);
  const { calls, invoke } = fixture({ create: async () => { throw new Error("Synthetic database failure"); } });
  const res = await invoke({ name: "Synthetic Author" }, file);
  assert.deepEqual(res.body, { code: 500, status: "error", message: "Author could not be created." });
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.unlink, [file]);
  assert.equal(fs.existsSync(file), false);
});

test("unlink failure after a successful write does not turn success into a retryable 500", async (t) => {
  const file = await tempFile(t);
  const { calls, invoke } = fixture({ unlink: async () => {
    throw Object.assign(new Error("Synthetic permission error"), { code: "EACCES" });
  } });
  const res = await invoke({ name: "Synthetic Author" }, file);
  assert.equal(res.code, 201);
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.unlink, [file]);
  assert.deepEqual(calls.logs, [["Author temporary upload cleanup failed:", "EACCES"]]);
});
