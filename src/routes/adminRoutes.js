import express from 'express';
import { createElection, getAllElections, addCandidate, uploadVoters, openElection, closeElection, getResults, getStats, getVoters, getLogs, getSecurityEvents, emergencyHalt, deleteElection } from '../controllers/adminController.js';
import { runSimulation } from '../controllers/simulationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/stats', getStats);
router.get('/elections', getAllElections);
router.get('/voters', getVoters);
router.get('/logs', getLogs);
router.get('/security-events', getSecurityEvents);
router.post('/emergency-halt', emergencyHalt);
router.post('/run-simulation', runSimulation);
router.post('/create-election', createElection);
router.delete('/election/:id', deleteElection);
router.post('/add-candidate', addCandidate);
router.post('/upload-voters', uploadVoters);
router.post('/open-election', openElection);
router.post('/close-election', closeElection);
router.get('/results/:electionId', getResults);

export default router;
