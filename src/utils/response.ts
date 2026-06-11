import { Response } from 'express';

export const sendResponse = (res: Response, status: number, message: string, data: any = null) => {
  return res.status(status).json({
    success: status >= 200 && status < 300,
    message,
    data,
  });
};

export const successResponse = (res: Response, message: string, data: any = null) => {
  return sendResponse(res, 200, message, data);
};

export const errorResponse = (res: Response, status: number, message: string) => {
  return sendResponse(res, status, message);
};