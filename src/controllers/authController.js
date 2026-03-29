import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database.js';
import { generateOTP, verifyOTP } from '../utils/otpService.js';
import { generateToken } from '../utils/generateToken.js';
import { logSecurityEvent, logAudit } from '../utils/logger.js';

export const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedRole = role || 'VOTER';
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: resolvedRole,
        voterId: resolvedRole === 'VOTER' ? uuidv4() : null
      }
    });

    await logAudit('USER_REGISTERED', user.id, { email, role });

    res.status(201).json({ 
      message: 'User registered successfully. Please login and verify OTP.',
      userId: user.id 
    });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: error?.message || 'Registration failed' });
  }
};

export const login = async (req, res) => {
  const { email, password, voterId } = req.body;
  const ip = req.ip;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await logSecurityEvent('FAILED_LOGIN', `Failed login attempt for email: ${email}`, ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If voterId is provided (Voter Login flow), verify it
    if (voterId && user.voterId !== voterId) {
      await logSecurityEvent('FAILED_LOGIN', `Invalid Voter ID attempt for email: ${email}`, ip);
      return res.status(401).json({ error: 'Invalid Voter ID' });
    }

    const otp = generateOTP(user.id);
    // In a real app, send OTP via email here

    res.json({ 
      message: 'OTP sent to your email', 
      userId: user.id 
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};

export const verifyOtp = async (req, res) => {
  const { userId, otp } = req.body;

  try {
    const isValid = verifyOTP(userId, otp);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user.verified) {
      await prisma.user.update({
        where: { id: userId },
        data: { verified: true }
      });
    }

    const sessionId = uuidv4();
    const token = generateToken(user, sessionId);

    await logAudit('USER_LOGIN', user.id, { sessionId });

    res.json({ 
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        voterId: user.voterId
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'OTP verification failed' });
  }
};

export const logout = async (req, res) => {
  try {
    await logAudit('USER_LOGOUT', req.user.id, { sessionId: req.sessionId });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
};
