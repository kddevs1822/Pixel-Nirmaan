import { Router } from 'express';
import { checkHealth } from '../controllers/healthController';
import { generateCode, generateToFolder, selectFolder } from '../controllers/generateController';
import { googleAuth, getMe } from '../controllers/authController';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projectController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/health', checkHealth);
router.post('/generate', generateCode);
router.post('/generate-to-folder', generateToFolder);
router.post('/select-folder', selectFolder);

// Auth routes
router.post('/auth/google', googleAuth);
router.get('/auth/me', authenticateToken, getMe);

// Project & Folder routes
router.get('/projects', authenticateToken, getProjects);
router.post('/projects', authenticateToken, createProject);
router.get('/projects/:id', authenticateToken, getProjectById);
router.put('/projects/:id', authenticateToken, updateProject);
router.delete('/projects/:id', authenticateToken, deleteProject);

export default router;
