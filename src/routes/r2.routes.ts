import express from "express";
import { uploadFile, listFiles, deleteFile } from "../controllers/r2.controller";

const router = express.Router();

router.post("/upload", uploadFile);
router.get("/list", listFiles);
router.delete("/delete/:key", deleteFile);

export default router;
