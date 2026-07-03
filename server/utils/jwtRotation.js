import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// JWT secret rotation is destructive: replacing the secret invalidates every
// token already issued, so every active session (staff browsers, API clients)
// is logged out and must re-authenticate. A routine — or accidental — server
// restart must therefore NEVER rotate the secret. Rotation is opt-in: it only
// runs when ENABLE_JWT_ROTATION=true, set deliberately when you intend to force
// a global re-login. Default (unset) = rotation disabled.
const isRotationEnabled = () => process.env.ENABLE_JWT_ROTATION === 'true';

// Generate a new JWT secret
export const generateJWTSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Rotate JWT secret in .env file
export const rotateJWTSecret = async () => {
  try {
    const envPath = path.join(__dirname, '../.env');
    
    if (!fs.existsSync(envPath)) {
      logger.error('JWT Rotation: .env file not found');
      return false;
    }

    // Read current .env file
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Generate new secret
    const newSecret = generateJWTSecret();
    
    // Replace JWT_SECRET in .env content
    const updatedContent = envContent.replace(
      /JWT_SECRET=.*/,
      `JWT_SECRET=${newSecret}`
    );

    // Write back to .env file
    fs.writeFileSync(envPath, updatedContent);
    
    // Update process.env for current session
    process.env.JWT_SECRET = newSecret;
    
    logger.info('JWT secret rotated successfully', {
      timestamp: new Date().toISOString(),
      secretLength: newSecret.length
    });
    
    return newSecret;
  } catch (error) {
    logger.error('JWT secret rotation failed', { error: error.message });
    return false;
  }
};

// Schedule automatic JWT secret rotation
export const scheduleJWTRotation = (intervalHours = 24) => {
  if (!isRotationEnabled()) {
    logger.info('JWT rotation scheduling skipped (set ENABLE_JWT_ROTATION=true to enable)');
    return null;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  logger.info(`JWT rotation scheduled every ${intervalHours} hours`);

  return setInterval(async () => {
    logger.info('Starting scheduled JWT secret rotation...');
    const newSecret = await rotateJWTSecret();
    
    if (newSecret) {
      logger.info('Scheduled JWT rotation completed successfully');
      
      // Emit event to notify clients to refresh tokens
      process.emit('jwt-rotated', { newSecret: newSecret.substring(0, 10) + '...' });
    } else {
      logger.error('Scheduled JWT rotation failed');
    }
  }, intervalMs);
};

// Force rotation on app start (opt-in via ENABLE_JWT_ROTATION).
export const rotateOnStart = async () => {
  if (!isRotationEnabled()) {
    logger.info('JWT rotation on start skipped (set ENABLE_JWT_ROTATION=true to enable)');
    return false;
  }

  logger.info('Performing JWT rotation on app start...');

  // Check if rotation is needed (e.g., based on last rotation time)
  const lastRotation = process.env.LAST_JWT_ROTATION;
  const now = Date.now();
  
  if (!lastRotation || (now - parseInt(lastRotation)) > (24 * 60 * 60 * 1000)) {
    const newSecret = await rotateJWTSecret();
    
    if (newSecret) {
      // Update last rotation timestamp
      const envPath = path.join(__dirname, '../.env');
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      const updatedContent = envContent.includes('LAST_JWT_ROTATION=')
        ? envContent.replace(/LAST_JWT_ROTATION=.*/, `LAST_JWT_ROTATION=${now}`)
        : envContent + `\nLAST_JWT_ROTATION=${now}`;
      
      fs.writeFileSync(envPath, updatedContent);
      process.env.LAST_JWT_ROTATION = now.toString();
      
      logger.info('JWT rotation on start completed');
      return true;
    }
  } else {
    logger.info('JWT rotation not needed - recent rotation detected');
  }
  
  return false;
};

export default {
  generateJWTSecret,
  rotateJWTSecret,
  scheduleJWTRotation,
  rotateOnStart
};
