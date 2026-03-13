// In a real app, this would send SMS or Email
// For this project, we'll log it to console and return it for easier testing if needed
// or just return a fixed one for now if user doesn't specify an email service

const otps = new Map(); // Store OTPs in memory for now (Reset on server restart)

export const generateOTP = (userId) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps.set(userId, {
    otp,
    expires: Date.now() + 10 * 60 * 1000 // 10 minutes
  });
  console.log(`OTP for User ${userId}: ${otp}`);
  return otp;
};

export const verifyOTP = (userId, otp) => {
  const data = otps.get(userId);
  if (!data) return false;
  if (data.expires < Date.now()) {
    otps.delete(userId);
    return false;
  }
  if (data.otp === otp) {
    otps.delete(userId);
    return true;
  }
  return false;
};
