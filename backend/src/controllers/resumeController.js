import { extractResumeText } from '../services/resumeParser.js';
import { setProfileResume } from '../services/profileService.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export function uploadResumeFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
          error: { code: 'RESUME_REQUIRED', message: 'Attach a resume using the "resume" field.' }
      });
    }

    return extractResumeText(req.file.path).then(async (resumeText) => {
      const resume = {
        id: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileType: path.extname(req.file.originalname).slice(1).toUpperCase(),
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        resumeText
      };
      await setProfileResume(req.user.id, resume);
      return res.status(201).json({
      success: true,
      message: 'Resume parsed and ready for analysis.',
      data: {
        resume
      }
    }); }).catch(async (error) => {
      // A failed parse must not leave an inaccessible file behind. Successful
      // uploads remain at their generated path, which is persisted with the
      // same canonical resume metadata for safe future recovery.
      await fs.unlink(req.file.path).catch(() => {});
      return next(error);
    });
  } catch (error) {
    return next(error);
  }
}
