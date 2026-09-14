import { Request, Response } from 'express';

export const checkHealth = (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running correctly.' });
};
