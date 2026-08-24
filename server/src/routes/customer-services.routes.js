import express from 'express';
import * as serviceReservationController from '../controllers/service-reservation.controller.js';
import { authenticateCustomer } from '../middlewares/customer-auth.js';

const router = express.Router();

// Note: authenticateCustomer ensures req.client has scope CUSTOMER and a valid clientId (no stayId)
router.use(authenticateCustomer);

// Middleware to inject stayId = null, reservationId = null, and enforce clientId
const injectExternalCustomer = (req, res, next) => {
  req.body.clientId = req.client.clientId;
  req.body.stayId = null;
  req.body.reservationId = null;
  
  // For GET requests, we force the query to filter by clientId and stayId=null
  req.query.clientId = req.client.clientId;
  req.query.stayId = 'null';
  
  next();
};

router.use(injectExternalCustomer);

// Reusing existing controllers
router.post('/', serviceReservationController.createReservation);
router.get('/', serviceReservationController.listReservations);
router.get('/:id', serviceReservationController.getReservationDetails);
router.post('/:id/payments', serviceReservationController.addPayment);

export default router;
