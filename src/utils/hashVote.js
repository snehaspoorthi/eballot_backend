import crypto from 'crypto';

export const generateVoteHash = (candidateId, timestamp, previousHash) => {
  const secret = process.env.VOTE_SECRET || 'EB_SECRET_KEY_2026';
  // Logic: SHA256(candidate_id + timestamp + previous_hash + secret_key)
  const data = candidateId + timestamp.toString() + (previousHash || 'GENESIS') + secret;
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
};

export const generateReceiptId = (voteHash, timestamp) => {
  const secret = process.env.VOTE_SECRET || 'EB_SECRET_KEY_2026';
  // Receipt generation: SHA256(vote_hash + timestamp + secret)
  return 'VOTE-' + crypto
    .createHash('sha256')
    .update(voteHash + timestamp.toString() + secret)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
};
