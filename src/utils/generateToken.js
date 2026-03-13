import jwt from 'jsonwebtoken';

export const generateToken = (user, sessionId) => {
  return jwt.sign(
    { 
      user_id: user.id, 
      role: user.role, 
      session_id: sessionId 
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: '1d' }
  );
};
