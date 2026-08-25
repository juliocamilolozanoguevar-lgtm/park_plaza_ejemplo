import express from 'express';
import { externalSession, googleSession } from '../controllers/customer-auth.controller.js';

const router = express.Router();

// External customer authentication (DEV bypass configured inside)
router.post('/session', externalSession);
router.post('/session/google', googleSession);

export default router;
