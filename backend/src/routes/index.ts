import { Router } from 'express';
import { checkHealth } from '../controllers/healthController';
import { generateCode, generateToFolder, selectFolder } from '../controllers/generateController';
import { googleAuth, getMe } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/health', checkHealth);
router.post('/generate', generateCode);
router.post('/generate-to-folder', generateToFolder);
router.post('/select-folder', selectFolder);

// Auth routes
router.post('/auth/google', googleAuth);
router.get('/auth/me', authenticateToken, getMe);

export default router;
