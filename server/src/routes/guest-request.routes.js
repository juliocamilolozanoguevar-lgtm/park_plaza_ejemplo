import express from 'express';
import * as guestRequestController from '../controllers/guest-request.controller.js';
import { authenticateClient } from '../middlewares/client-auth.js';

const router = express.Router();

// Note: authenticateClient ensures that req.client exists and has a valid stayId
router.use(authenticateClient);

router.post('/', guestRequestController.createGuestRequest);
router.get('/', guestRequestController.getGuestRequests);
router.get('/:id', guestRequestController.getGuestRequestById);
router.patch('/:id/cancel', guestRequestController.cancelGuestRequest);

export default router;
