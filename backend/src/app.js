import express from 'express';
import cors from 'cors';
import resumeRoutes from './routes/resumeRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import careerRoutes from './routes/careerRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import placementJobRoutes from './routes/placementJobRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dsaRoutes from './routes/dsaRoutes.js';
import tpoRoutes from './routes/tpoRoutes.js';
import { analyzeJobDescription } from './controllers/jobController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { profilePhotoDirectory } from './middleware/upload.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/profile-photos', express.static(profilePhotoDirectory, { dotfiles: 'deny', index: false, maxAge: '7d' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'PlaceNexus API is healthy' });
});

app.use('/auth', authRoutes);
app.use('/resume', requireAuth, resumeRoutes);
app.post('/analyze', requireAuth, analyzeJobDescription);
app.use('/job', requireAuth, jobRoutes);
app.use('/career', requireAuth, careerRoutes);
app.use('/profile', requireAuth, profileRoutes);
app.use('/jobs', requireAuth, placementJobRoutes);
app.use('/applications', requireAuth, applicationRoutes);
app.use('/notifications', requireAuth, notificationRoutes);
app.use('/api/dsa', requireAuth, dsaRoutes);
app.use('/tpo', requireAuth, requireAdmin, tpoRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
