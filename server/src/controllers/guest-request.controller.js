import * as guestRequestService from '../services/guest-request.service.js';

export const createGuestRequest = async (req, res, next) => {
  try {
    const { clientId, stayId, roomId } = req.client;
    const requestData = req.body;
    
    const newRequest = await guestRequestService.createGuestRequest(clientId, stayId, roomId, requestData);
    
    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    next(error);
  }
};

export const getGuestRequests = async (req, res, next) => {
  try {
    const { stayId } = req.client;
    const requests = await guestRequestService.getGuestRequests(stayId);
    
    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

export const getGuestRequestById = async (req, res, next) => {
  try {
    const { stayId } = req.client;
    const { id } = req.params;
    
    const request = await guestRequestService.getGuestRequestById(id, stayId);
    
    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

export const cancelGuestRequest = async (req, res, next) => {
  try {
    const { stayId } = req.client;
    const { id } = req.params;
    
    const cancelled = await guestRequestService.cancelGuestRequest(id, stayId);
    
    res.json({ success: true, data: cancelled });
  } catch (error) {
    next(error);
  }
};
