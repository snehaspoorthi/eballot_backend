import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database.js';
import { generateVoteHash, generateReceiptId } from '../utils/hashVote.js';
import { logAudit } from '../utils/logger.js';

export const getElections = async (req, res) => {
  try {
    const elections = await prisma.election.findMany({
      where: { status: 'OPEN' }
    });
    res.json(elections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch elections' });
  }
};

export const getElectionById = async (req, res) => {
  const { id } = req.params;
  try {
    const election = await prisma.election.findUnique({
      where: { id },
      include: { candidates: true }
    });
    res.json(election);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch election' });
  }
};

/**
 * GET /api/voter/voted-elections
 * Returns array of election IDs the user has already voted in
 */
export const getVotedElections = async (req, res) => {
  try {
    const tokens = await prisma.votingToken.findMany({
      where: { userId: req.user.id, used: true },
      select: { electionId: true }
    });
    const votedIds = tokens.map(t => t.electionId);
    res.json({ votedElectionIds: votedIds });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch voted elections' });
  }
};

export const castVote = async (req, res) => {
  const { electionId, candidateId, voterId: submittedVoterId } = req.body;
  const userId = req.user.id;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  // Verify the submitted voter ID matches the authenticated user's voter ID
  if (!submittedVoterId) {
    return res.status(400).json({ error: 'Voter ID is required to cast a vote' });
  }

  if (req.user.voterId !== submittedVoterId) {
    return res.status(403).json({ error: 'Invalid Voter ID. Please check your Voter ID in your Profile.' });
  }

  try {
    // Advanced Fraud Detection: Check for duplicate IPs in a short period
    const recentIpVotes = await prisma.securityEvent.count({
        where: {
            eventType: 'DEBUG',
            ipAddress,
            createdAt: {
                gt: new Date(Date.now() - 60000)
            }
        }
    });

    if (recentIpVotes > 10) {
        await prisma.securityEvent.create({
            data: {
                eventType: 'FRAUD_SUSPICION',
                description: `High voting rate detected from IP ${ipAddress}`,
                ipAddress
            }
        });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if user already voted IN THIS SPECIFIC ELECTION (not globally)
      const existingToken = await tx.votingToken.findFirst({
        where: {
          userId: userId,
          electionId: electionId,
          used: true
        }
      });

      if (existingToken) {
        throw new Error('You have already voted in this election');
      }

      // 2. Check if election is OPEN
      const election = await tx.election.findUnique({
        where: { id: electionId }
      });

      if (!election || election.status !== 'OPEN') {
        throw new Error('Election is not open');
      }

      // 3. Issue and mark a voting token as used (Anonymous link)
      await tx.votingToken.create({
        data: {
          token: uuidv4(),
          userId: userId,
          electionId: electionId,
          used: true
        }
      });

      // 4. Fetch the previous vote to link the chain
      const lastVote = await tx.vote.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      const previousHash = lastVote ? lastVote.voteHash : 'GENESIS';

      // 5. Generate anonymous vote hash and receipt
      const timestamp = new Date();
      const voteHash = generateVoteHash(candidateId, timestamp.getTime(), previousHash);
      const receiptId = generateReceiptId(voteHash, timestamp.getTime());

      // 6. Store anonymous vote with chain info
      const vote = await tx.vote.create({
        data: {
          voteHash,
          previousHash,
          receiptId,
          timestamp,
          electionId,
          candidateId
        }
      });

      // 7. Update user's hasVoted flag (for general profile display)
      await tx.user.update({
        where: { id: userId },
        data: { hasVoted: true }
      });

      return { receiptId };
    }, { timeout: 10000 });

    await logAudit('VOTE_CAST', userId, { electionId, ipAddress });

    res.json({
      message: 'Vote cast successfully',
      receiptId: result.receiptId
    });
  } catch (error) {
    console.error("CastVote Error:", error);
    res.status(400).json({ error: error.message || 'Failed to cast vote' });
  }
};

export const verifyReceipt = async (req, res) => {
  const { receiptId } = req.params;
  try {
    const vote = await prisma.vote.findUnique({
      where: { receiptId }
    });

    if (!vote) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({ 
        message: 'Vote inclusion verified',
        status: 'SUCCESS',
        timestamp: vote.timestamp,
        electionId: vote.electionId
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
};
