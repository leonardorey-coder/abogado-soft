import { Router } from 'express';

export const driveRouter = Router();

const disabledPayload = {
  connected: false,
  disabled: true,
  provider: 'r2',
  message: 'Google Drive legacy storage is disabled. Use /api/storage backed by R2.',
};

driveRouter.get('/status', (_req, res) => {
  res.json(disabledPayload);
});

driveRouter.use((_req, res) => {
  res.status(410).json(disabledPayload);
});
