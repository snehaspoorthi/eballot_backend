import { prisma } from '../config/database.js';
import { logAudit } from '../utils/logger.js';

export const createElection = async (req, res) => {
  const { title, description, startTime, endTime } = req.body;

  try {
    const election = await prisma.election.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdBy: req.user.id
      }
    });

    await logAudit('ELECTION_CREATED', req.user.id, { electionId: election.id });

    res.status(201).json(election);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create election' });
  }
};

export const getAllElections = async (req, res) => {
  try {
    const elections = await prisma.election.findMany({
      orderBy: { createdAt: 'desc' },
      include: { candidates: true }
    });
    res.json(elections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch elections' });
  }
};


export const addCandidate = async (req, res) => {
  const { name, party, description, electionId } = req.body;

  try {
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ error: 'Election not found' });
    if (election.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Cannot add candidates to an election that is already open or closed' });
    }

    const candidate = await prisma.candidate.create({
      data: {
        name,
        party,
        description,
        electionId
      }
    });

    res.status(201).json(candidate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add candidate' });
  }
};

export const openElection = async (req, res) => {
  const { electionId } = req.body;

  try {
    const election = await prisma.election.update({
      where: { id: electionId },
      data: { status: 'OPEN' }
    });

    await logAudit('ELECTION_OPENED', req.user.id, { electionId });

    res.json(election);
  } catch (error) {
    res.status(500).json({ error: 'Failed to open election' });
  }
};

export const closeElection = async (req, res) => {
  const { electionId } = req.body;

  try {
    const election = await prisma.election.update({
      where: { id: electionId },
      data: { status: 'CLOSED' }
    });

    await logAudit('ELECTION_CLOSED', req.user.id, { electionId });

    res.json(election);
  } catch (error) {
    res.status(500).json({ error: 'Failed to close election' });
  }
};

export const getResults = async (req, res) => {
  const { electionId } = req.params;

  try {
    const results = await prisma.candidate.findMany({
      where: { electionId },
      include: {
        _count: {
          select: { votes: true }
        }
      }
    });

    const turnout = await prisma.user.count({ 
      where: { hasVoted: true } // Simplified: in real app, filter by voters assigned to this election
    });

    res.json({ results, turnout });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
};

// Simplified voter upload
export const uploadVoters = async (req, res) => {
  const { voters, electionId } = req.body; // voters is an array of {name, email}

  try {
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (election.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Cannot upload voters after election starts' });
    }

    // In a real app, you'd probably batch invite/create users
    // For now, we'll just log the action
    await logAudit('VOTERS_UPLOADED', req.user.id, { electionId, count: voters.length });

    res.json({ message: `${voters.length} voters processed` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload voters' });
  }
};

export const getStats = async (req, res) => {
  try {
    const totalVoters = await prisma.user.count({ where: { role: 'VOTER' } });
    const votesCast = await prisma.vote.count();
    const activeElections = await prisma.election.count({ where: { status: 'OPEN' } });
    const securityEventsCount = await prisma.securityEvent.count();
    
    let turnout = 0;
    if (totalVoters > 0) {
      turnout = Math.round((votesCast / totalVoters) * 100);
    }

    // Get the most recent open election for the dashboard chart
    const latestElection = await prisma.election.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: {
        candidates: {
          include: {
            _count: {
              select: { votes: true }
            }
          }
        }
      }
    });

    let chartData = [];
    if (latestElection) {
      chartData = latestElection.candidates.map(c => ({
        name: c.name,
        votes: c._count.votes,
        party: c.party
      }));
    }

    // Get recent audit logs
    const recentLogs = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      totalVoters,
      votesCast,
      turnout,
      activeElections,
      securityEvents: securityEventsCount,
      chartData,
      electionTitle: latestElection?.title || "No Active Election",
      recentLogs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

export const getVoters = async (req, res) => {
    try {
      const voters = await prisma.user.findMany({
        where: { role: 'VOTER' },
        select: {
          id: true,
          name: true,
          email: true,
          verified: true,
          hasVoted: true,
          createdAt: true,
          voterId: true
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(voters);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch voters' });
    }
  };

export const getLogs = async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

export const getSecurityEvents = async (req, res) => {
  try {
    const events = await prisma.securityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
};

export const emergencyHalt = async (req, res) => {
  try {
    // Logic: Force close all OPEN elections immediately
    await prisma.election.updateMany({
      where: { status: 'OPEN' },
      data: { status: 'CLOSED' }
    });

    await logAudit('EMERGENCY_HALT', req.user.id, { reason: 'Admin triggered emergency halt' });
    
    // Also create a security event record
    await prisma.securityEvent.create({
        data: {
            eventType: 'EMERGENCY_HALT',
            description: 'All active elections were force-closed by an administrator.',
            ipAddress: req.ip || 'INTERNAL'
        }
    });

    res.json({ message: 'Security lockdown successful. All active elections have been terminated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger emergency halt' });
  }
};

export const deleteElection = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.election.delete({
            where: { id }
        });
        await logAudit('ELECTION_DELETED', req.user.id, { electionId: id });
        res.json({ message: 'Election and all associated data deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete election' });
    }
};
