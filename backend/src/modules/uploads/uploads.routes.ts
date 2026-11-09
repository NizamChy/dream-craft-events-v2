import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import sharp, { type OutputInfo } from "sharp";
import { prisma } from "../../lib/prisma.js";
import { authenticate, currentUser } from "../../middlewares/auth.js";
import { ApiError } from "../../utils/http.js";

/**
 * Bundled seed images (and any legacy files) are served from here.
 * Found relative to this file, not process.cwd(): on Vercel the function's
 * working directory is the repo root while the code lives in backend/.
 * Works from src/ (tsx) and dist/src/ (compiled) alike.
 */
function findUploadRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "uploads", "seed"))) return path.join(dir, "uploads");
    dir = path.dirname(dir);
  }
  return path.resolve(process.cwd(), "uploads");
}
export const UPLOAD_ROOT = findUploadRoot();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(ApiError.badRequest("Only JPG, PNG, WEBP, AVIF or GIF images are allowed"));
  },
});

const router = Router();

/**
 * Accepts an image, auto-rotates it, resizes to max 1600px wide and stores an
 * optimized WebP in the database (serverless hosts have no persistent disk).
 * Returns a URL path that the frontend serves via its proxy.
 */
router.post("/", authenticate, upload.single("image"), async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Please attach an image in the 'image' field");

  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw ApiError.badRequest("The file could not be processed as an image");
  }

  const { data, info } = output;
  const saved = await prisma.upload.create({
    data: { data: new Uint8Array(data), width: info.width, height: info.height, size: info.size, userId: currentUser(req).id },
    select: { id: true },
  });
  res.status(201).json({ url: `/uploads/db/${saved.id}.webp`, width: info.width, height: info.height, size: info.size });
});

export default router;

/** GET /uploads/db/:id.webp — file names are unique, so cache forever. */
export const uploadFileRouter = Router();

uploadFileRouter.get("/:file", async (req, res) => {
  const id = /^([a-z0-9]{20,40})\.webp$/.exec(req.params.file)?.[1];
  const file = id ? await prisma.upload.findUnique({ where: { id }, select: { data: true, mimeType: true } }) : null;
  if (!file) throw ApiError.notFound("Image not found");
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(file.data));
});
