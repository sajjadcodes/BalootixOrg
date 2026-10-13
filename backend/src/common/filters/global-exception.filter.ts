import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import type { ErrorResponse } from '../types/success-response.interface.js';
import { getErrorDetails } from '../utils/error.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();

    let errorResponse: ErrorResponse = {
      success: false,
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      const result = getErrorDetails(exception.getStatus(), exception);
      errorResponse = {
        success: false,
        code: result.code,
        message: result.message,
      };
    }

    response.status(errorResponse.code).json(errorResponse);
  }
}
