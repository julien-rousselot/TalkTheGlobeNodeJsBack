import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Request, Response } from "express";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB - good for most PDFs
    files: 15, // Max 15 files per request
    fieldNameSize: 50,
    fieldSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed.`));
    }
  }
});

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Upload file endpoint
export const uploadFile = [
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      console.log(` Upload Debug - File size: ${file.size} bytes, MIME: ${file.mimetype}`);
      
      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({ error: "File buffer is empty" });
      }

      const fileName = `${Date.now()}-${file.originalname}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      const publicUrl = `${process.env.R2_BASE_URL}/${fileName}`;
      console.log(` Upload successful: ${publicUrl}`);
      
      return res.json({ success: true, url: publicUrl });
    } catch (error) {
      console.error(' R2 Upload Error:', error);
      return res.status(500).json({ error: "Upload failed" });
    }
  },
];

// Helper function for programmatic uploads
export const uploadFileToR2 = async (file: Express.Multer.File, folder: string = ''): Promise<string> => {
  console.log(`📁 R2 Helper Debug - File: ${file.originalname}, Size: ${file.size} bytes`);
  console.log(`📁 File properties:`, { 
    hasBuffer: !!file.buffer, 
    bufferLength: file.buffer?.length || 0,
    filePath: (file as any).path || 'No path',
    fieldname: file.fieldname,
    mimetype: file.mimetype
  });
  
  // Check if file has buffer (memory storage) or path (disk storage)
  if (!file.buffer && !(file as any).path) {
    throw new Error(`File has no buffer or path for ${file.originalname}. Make sure to use memory storage.`);
  }
  
  if (file.buffer && file.buffer.length === 0) {
    throw new Error(`File buffer is empty for ${file.originalname}`);
  }
  
  // If file is stored on disk, read it into memory
  let fileBuffer: Buffer;
  if (file.buffer) {
    fileBuffer = file.buffer;
  } else if ((file as any).path) {
    const fs = require('fs');
    fileBuffer = fs.readFileSync((file as any).path);
  } else {
    throw new Error(`Cannot access file data for ${file.originalname}`);
  }
  
  const allowedMimeTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} is not allowed`);
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}-${file.originalname}`;
  
  // 🔧 Fix double slash issue: remove trailing slash from folder if present
  const cleanFolder = folder.endsWith('/') ? folder.slice(0, -1) : folder;
  const key = cleanFolder ? `${cleanFolder}/${fileName}` : fileName;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: fileBuffer,
      ContentType: file.mimetype,
      ContentLength: fileBuffer.length,
    })
  );

  const publicUrl = `${process.env.R2_BASE_URL}/${key}`;
  
  return publicUrl;
};

// List files
export const listFiles = async (req: Request, res: Response) => {
  try {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME!,
      })
    );

    const files = response.Contents?.map((f) => ({
      key: f.Key,
      lastModified: f.LastModified,
      size: f.Size,
      url: `${process.env.R2_BASE_URL}/${f.Key}`,
    }));

    return res.json(files || []);
  } catch (error) {
    console.error("List error:", error);
    return res.status(500).json({ error: "Failed to list files" });
  }
};

// Delete file
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: "Missing file key" });

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
      })
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({ error: "Failed to delete file" });
  }
};

export { upload };
