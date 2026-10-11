import fs from 'node:fs';
import { assignLegacyResume, getLegacyResumePreview, listLegacyResumes } from '../services/legacyResumeService.js';

export async function listLegacyResumeInventory(_req, res, next) {
  try {
    return res.status(200).json({ success: true, data: { items: await listLegacyResumes() } });
  } catch (error) {
    return next(error);
  }
}

export async function previewLegacyResume(req, res, next) {
  try {
    const preview = await getLegacyResumePreview(req.params.legacyResumeId);
    res.status(200);
    res.set({
      'Content-Type': preview.metadata.mimeType,
      'Content-Length': String(preview.metadata.size),
      'Content-Disposition': `inline; filename="legacy-resume-${preview.legacyResumeId}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    });
    const stream = fs.createReadStream(preview.filePath);
    stream.once('error', next);
    return stream.pipe(res);
  } catch (error) {
    return next(error);
  }
}

export async function assignLegacyResumeToStudent(req, res, next) {
  try {
    const result = await assignLegacyResume({
      legacyResumeId: req.params.legacyResumeId,
      studentId: req.body?.studentId,
      replaceExisting: req.body?.replaceExisting === true,
      confirmed: req.body?.confirmed === true,
      assignedBy: req.user?.id
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}
