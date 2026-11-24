import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/db';
import { config } from '../config/env';

const googleClient = new OAuth2Client(config.google.clientId);

export class AuthController {
  /**
   * Real Google OAuth Login handler
   */
  public static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { credential, profile } = req.body;

      let email = '';
      let name = '';
      let avatar = '';
      let googleId = '';

      if (credential) {
        // If credential JWT is provided from Google Sign-In
        try {
          if (config.google.clientId) {
            const ticket = await googleClient.verifyIdToken({
              idToken: credential,
              audience: config.google.clientId,
            });
            const payload = ticket.getPayload();
            if (payload) {
              email = payload.email || '';
              name = payload.name || '';
              avatar = payload.picture || '';
              googleId = payload.sub;
            }
          } else {
            // Decode standard JWT payload if running locally before client ID is configured
            const base64Url = credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              Buffer.from(base64, 'base64')
                .toString('latin1')
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const decoded = JSON.parse(jsonPayload);
            email = decoded.email || '';
            name = decoded.name || '';
            avatar = decoded.picture || '';
            googleId = decoded.sub || '';
          }
        } catch (err: any) {
          console.warn('[AuthController] Google token verification error:', err.message);
        }
      }

      // If profile object is passed directly from client-side Google OAuth hook
      if (!email && profile) {
        email = profile.email;
        name = profile.name;
        avatar = profile.avatar || profile.picture;
        googleId = profile.googleId || profile.sub || profile.id;
      }

      if (!email) {
        res.status(400).json({ error: 'Could not extract valid Google profile information' });
        return;
      }

      // Upsert user in database
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name,
          avatar,
          googleId,
        },
        create: {
          email,
          name,
          avatar,
          googleId,
        },
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      });
    } catch (err: any) {
      console.error('[AuthController] Error in Google login:', err);
      res.status(500).json({ error: 'Authentication failed', details: err.message });
    }
  }

  /**
   * Get current authenticated user
   */
  public static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const email = req.query.email as string;
      if (!email) {
        res.status(400).json({ error: 'Email parameter required' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch user', details: err.message });
    }
  }
}
