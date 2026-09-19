import { Router } from 'express';
import { checkHealth } from '../controllers/healthController';
import { generateCode, generateToFolder } from '../controllers/generateController';

const router = Router();

router.get('/health', checkHealth);
router.post('/generate', generateCode);
router.post('/generate-to-folder', generateToFolder);

export default router;
