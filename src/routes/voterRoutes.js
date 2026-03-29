import express from 'express';
import { getElections, getElectionById, castVote, verifyReceipt, getVotedElections } from '../controllers/voterController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/elections', getElections);
router.get('/verify-receipt/:receiptId', verifyReceipt);

router.use(authenticate);

router.get('/voted-elections', getVotedElections);
router.get('/election/:id', authorize(['VOTER', 'ADMIN', 'AUDITOR']), getElectionById);
router.post('/cast-vote', authorize('VOTER'), castVote);

export default router;
