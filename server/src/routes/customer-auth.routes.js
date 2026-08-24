import express from 'express';
import { externalSession } from '../controllers/customer-auth.controller.js';

const router = express.Router();

// External customer authentication (DEV bypass configured inside)
router.post('/session', externalSession);

export default router;
