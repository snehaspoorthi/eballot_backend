import express from 'express';
import { verifyLedger, getHealth } from '../controllers/auditController.js';

const router = express.Router();

router.get('/verify-ledger', verifyLedger);
router.get('/health', getHealth);

export default router;
