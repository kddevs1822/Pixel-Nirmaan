import { Router } from 'express';
import { checkHealth } from '../controllers/healthController';
import { generateCode } from '../controllers/generateController';

const router = Router();

router.get('/health', checkHealth);
router.post('/generate', generateCode);

export default router;
