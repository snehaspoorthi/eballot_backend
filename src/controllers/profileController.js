import bcrypt from 'bcrypt';
import { prisma } from '../config/database.js';
import { logAudit } from '../utils/logger.js';

/**
 * GET /api/profile
 * Returns the authenticated user's profile + voting history
 */
export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        voterId: true,
        verified: true,
        hasVoted: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find all elections the user participated in via VotingToken (used = true)
    const participatedElections = await prisma.votingToken.findMany({
      where: {
        userId: req.user.id,
        used: true
      },
      select: {
        electionId: true,
        issuedAt: true
      }
    });

    // Fetch election details for each participation
    let electionHistory = [];
    if (participatedElections.length > 0) {
      const electionIds = participatedElections.map(p => p.electionId);
      const elections = await prisma.election.findMany({
        where: { id: { in: electionIds } },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          startTime: true,
          endTime: true
        }
      });

      electionHistory = elections.map(e => {
        const token = participatedElections.find(p => p.electionId === e.id);
        return {
          ...e,
          votedAt: token?.issuedAt || null
        };
      });
    }

    res.json({
      ...user,
      electionHistory
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * PUT /api/profile/email
 * Update the user's email address
 */
export const updateEmail = async (req, res) => {
  const { newEmail, password } = req.body;

  if (!newEmail || !password) {
    return res.status(400).json({ error: 'New email and current password are required' });
  }

  try {
    // Verify current password
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Check if email is already taken
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return res.status(400).json({ error: 'This email is already registered' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { email: newEmail }
    });

    await logAudit('EMAIL_UPDATED', req.user.id, { oldEmail: user.email, newEmail });

    res.json({ message: 'Email updated successfully' });
  } catch (error) {
    console.error('Email update error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
};

/**
 * PUT /api/profile/password
 * Update the user's password
 */
export const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newHash }
    });

    await logAudit('PASSWORD_UPDATED', req.user.id, {});

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
};
