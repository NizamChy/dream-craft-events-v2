import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { authenticate } from "../../middlewares/auth.js";
import { ApiError } from "../../utils/http.js";

export const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

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
 * optimized WebP. Returns a URL path that the frontend serves via its proxy.
 */
router.post("/", authenticate, upload.single("image"), async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Please attach an image in the 'image' field");

  const now = new Date();
  const folder = path.join(UPLOAD_ROOT, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  await mkdir(folder, { recursive: true });
  const fileName = `${randomUUID()}.webp`;

  try {
    const info = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(path.join(folder, fileName));

    const relative = path.relative(UPLOAD_ROOT, path.join(folder, fileName)).split(path.sep).join("/");
    res.status(201).json({ url: `/uploads/${relative}`, width: info.width, height: info.height, size: info.size });
  } catch {
    throw ApiError.badRequest("The file could not be processed as an image");
  }
});

export default router;
