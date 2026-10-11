import { Router } from 'express';
import {
  archiveCampusPlacementJob,
  analyzeCampusJobDescription,
  closeCampusPlacementJob,
  createCampusPlacementJob,
  getCampusDriveAnalytics,
  getPlacementJob,
  listCampusJobApplications,
  listEligibleCampusStudents,
  listManagedCampusJobs,
  listOffCampusPlacementJobs,
  listOnCampusPlacementJobs,
  publishCampusPlacementJob,
  unpublishCampusPlacementJob,
  updateCampusApplication,
  updateCampusPlacementJob
} from '../controllers/placementJobController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.get('/on-campus', listOnCampusPlacementJobs);
router.get('/off-campus', listOffCampusPlacementJobs);
router.get('/manage/on-campus', requireAdmin, listManagedCampusJobs);
router.post('/on-campus/analyze-jd', requireAdmin, analyzeCampusJobDescription);
router.post('/on-campus', requireAdmin, createCampusPlacementJob);
router.put('/on-campus/:jobId', requireAdmin, updateCampusPlacementJob);
router.post('/on-campus/:jobId/publish', requireAdmin, publishCampusPlacementJob);
router.post('/on-campus/:jobId/unpublish', requireAdmin, unpublishCampusPlacementJob);
router.post('/on-campus/:jobId/close', requireAdmin, closeCampusPlacementJob);
router.delete('/on-campus/:jobId', requireAdmin, archiveCampusPlacementJob);
router.get('/on-campus/:jobId/analytics', requireAdmin, getCampusDriveAnalytics);
router.get('/on-campus/:jobId/applications', requireAdmin, listCampusJobApplications);
router.get('/on-campus/:jobId/eligible-students', requireAdmin, listEligibleCampusStudents);
router.patch('/manage/applications/:applicationId', requireAdmin, updateCampusApplication);
router.get('/:jobId', getPlacementJob);

export default router;
