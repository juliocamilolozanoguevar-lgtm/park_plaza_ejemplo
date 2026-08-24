import express from 'express';
import { authenticateCustomer } from '../middlewares/customer-auth.js';
import {
  createReservation,
  listReservations,
  getReservationDetails,
  cancelReservation,
  addPayment,
  menu,
  createOrder,
  listOrders,
} from '../controllers/customer-services.controller.js';

const router = express.Router();

// Todas las rutas exigen JWT con scope=CUSTOMER
router.use(authenticateCustomer);

// Crear reserva de servicio (PISCINA o MIRADOR)
router.post('/', createReservation);

// Listar reservas propias
router.get('/', listReservations);

router.get('/menu/:area', menu);
router.post('/orders', createOrder);
router.get('/orders', listOrders);

// Detalle de reserva propia
router.get('/:id', getReservationDetails);

// Cancelar reserva propia
router.patch('/:id/cancel', cancelReservation);

// Registrar pago de reserva propia
router.post('/:id/payments', addPayment);

export default router;
