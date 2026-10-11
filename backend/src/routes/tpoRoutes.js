import { Router } from 'express';
import { tpoApplications, tpoDashboard, tpoNotifications, tpoProfile, tpoStudent, tpoStudents } from '../controllers/tpoController.js';
import { assignLegacyResumeToStudent, listLegacyResumeInventory, previewLegacyResume } from '../controllers/legacyResumeController.js';

const router = Router();

router.get('/dashboard', tpoDashboard);
router.get('/students', tpoStudents);
router.get('/students/:studentId', tpoStudent);
router.get('/applications', tpoApplications);
router.get('/notifications', tpoNotifications);
router.get('/profile', tpoProfile);
router.get('/legacy-resumes', listLegacyResumeInventory);
router.get('/legacy-resumes/:legacyResumeId/preview', previewLegacyResume);
router.post('/legacy-resumes/:legacyResumeId/assign', assignLegacyResumeToStudent);

export default router;
