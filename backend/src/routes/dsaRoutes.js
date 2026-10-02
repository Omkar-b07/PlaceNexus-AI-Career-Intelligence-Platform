import { Router } from 'express';
import { getDashboard, getProgress, listDifficulties, listProblems, listTopics, updateProblemStatus } from '../controllers/dsaController.js';

const router = Router();
router.get('/problems', listProblems);
router.get('/topics', listTopics);
router.get('/difficulties', listDifficulties);
router.get('/dashboard', getDashboard);
router.get('/progress', getProgress);
router.patch('/problems/:problemId/status', updateProblemStatus);
export default router;
