import { Router } from 'express';
import { checkHealth } from '../controllers/healthController';
import { generateCode, generateToFolder, selectFolder } from '../controllers/generateController';

const router = Router();

router.get('/health', checkHealth);
router.post('/generate', generateCode);
router.post('/generate-to-folder', generateToFolder);
router.post('/select-folder', selectFolder);

export default router;
