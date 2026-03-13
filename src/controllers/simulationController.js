import { prisma } from '../config/database.js';

export const runSimulation = async (req, res) => {
  const { number_of_voters, number_of_votes } = req.body;

  try {
    // Create a simulation session
    const simulation = await prisma.simulationElection.create({
      data: {
        title: `Simulated Election ${new Date().toLocaleString()}`
      }
    });

    const mockCandidates = ['Alice', 'Bob', 'Charlie', 'Dana'];
    const results = [];

    for (let i = 0; i < (number_of_votes || 100); i++) {
      const selectedCandidate = mockCandidates[Math.floor(Math.random() * mockCandidates.length)];
      
      await prisma.simulationVote.create({
        data: {
          candidate: selectedCandidate,
          simulationId: simulation.id
        }
      });

      results.push(selectedCandidate);
    }

    // Tally results
    const tally = mockCandidates.reduce((acc, name) => {
      acc[name] = results.filter(v => v === name).length;
      return acc;
    }, {});

    res.json({
      message: 'Simulation completed successfully',
      simulationId: simulation.id,
      votersSimulated: number_of_voters || number_of_votes,
      tally
    });
  } catch (error) {
    res.status(500).json({ error: 'Simulation failed' });
  }
};
