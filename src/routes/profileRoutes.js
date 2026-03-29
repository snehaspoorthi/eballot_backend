import express from 'express';
import { getProfile, updateEmail, updatePassword } from '../controllers/profileController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// All profile routes require authentication
router.use(authenticate);

router.get('/', getProfile);
router.put('/email', updateEmail);
router.put('/password', updatePassword);

export default router;
