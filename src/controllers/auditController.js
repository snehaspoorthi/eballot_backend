import { prisma } from '../config/database.js';
import { generateVoteHash } from '../utils/hashVote.js';

export const verifyLedger = async (req, res) => {
  try {
    const votes = await prisma.vote.findMany({
      orderBy: { timestamp: 'asc' }
    });

    let currentPreviousHash = 'GENESIS';
    const auditResults = [];
    let isTampered = false;

    for (let i = 0; i < votes.length; i++) {
      const vote = votes[i];
      
      // Expected hash based on stored data
      const expectedHash = generateVoteHash(
        vote.candidateId, 
        vote.timestamp.getTime(), 
        vote.previousHash
      );

      const nodeHealth = {
        voteId: vote.id,
        storedHash: vote.voteHash,
        expectedHash: expectedHash,
        storedPreviousHash: vote.previousHash,
        expectedPreviousHash: currentPreviousHash,
        valid: (vote.voteHash === expectedHash) && (vote.previousHash === currentPreviousHash)
      };

      if (!nodeHealth.valid) {
        isTampered = true;
      }

      auditResults.push(nodeHealth);
      currentPreviousHash = vote.voteHash;
    }

    res.json({
      status: isTampered ? 'TAMPERED' : 'SECURE',
      totalVotes: votes.length,
      integrityScore: votes.length > 0 ? (auditResults.filter(r => r.valid).length / votes.length) * 100 : 100,
      chain: auditResults.slice(-10) // Return last 10 nodes for preview
    });
  } catch (error) {
    console.error("Audit Error:", error);
    res.status(500).json({ error: 'Ledger verification failed' });
  }
};

export const getHealth = async (req, res) => {
    try {
        const dbStatus = await prisma.$queryRaw`SELECT 1`;

        const [totalVoters, totalVotes, activeElections] = await Promise.all([
            prisma.user.count({ where: { role: 'VOTER' } }),
            prisma.vote.count(),
            prisma.election.count({ where: { status: 'OPEN' } }),
        ]);

        const turnout = totalVoters > 0 ? Math.round((totalVotes / totalVoters) * 100) : 0;

        res.json({
            server: 'RUNNING',
            database: dbStatus ? 'CONNECTED' : 'ERROR',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date(),
            totalVoters,
            totalVotes,
            activeElections,
            turnout,
        });
    } catch (err) {
        res.status(500).json({ server: 'ERROR', database: 'DISCONNECTED' });
    }
}

