import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('GOOGLE_CLIENT_ID environment variable is missing');
      return res.status(500).json({ error: 'Server configuration error: GOOGLE_CLIENT_ID missing' });
    }

    const googleClient = new OAuth2Client(clientId);

    // Verify Google ID Token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token payload' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Upsert user in PostgreSQL database
    const user = await prisma.user.upsert({
      where: { googleId },
      update: {
        name: name || 'User',
        picture: picture || null,
        email: email,
      },
      create: {
        googleId,
        email,
        name: name || 'User',
        picture: picture || null,
      },
    });

    // Generate JWT token (valid for 7 days)
    const JWT_SECRET = process.env.JWT_SECRET || 'pixelnirmaan_jwt_secret_key_2026_super_secure';
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error: any) {
    console.error('Error during Google authentication:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      details: error.message || 'Unknown error',
    });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};
