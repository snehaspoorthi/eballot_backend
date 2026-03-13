import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { prisma } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import voterRoutes from './routes/voterRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Hardening: Rate Limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window`
	standardHeaders: 'draft-7',
	legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

// Apply rate limiter to all requests
app.use(limiter);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/voter', voterRoutes);
app.use('/api/audit', auditRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    service: 'E-Ballot Research Portal' 
  });
});

app.listen(PORT, () => {
  console.log(`[SYSTEM] E-Ballot Server Active on port ${PORT}`);
  console.log(`[SECURITY] Rate Limiting Enabled`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
