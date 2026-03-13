import { prisma } from '../config/database.js';

export const logSecurityEvent = async (eventType, description, ipAddress = null) => {
  try {
    await prisma.securityEvent.create({
      data: {
        eventType,
        description,
        ipAddress
      }
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

export const logAudit = async (action, userId = null, metadata = {}) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        metadata
      }
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};
