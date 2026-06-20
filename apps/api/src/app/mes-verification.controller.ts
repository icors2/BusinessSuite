import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from 'auth';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { StorageService } from 'storage';

interface AuthenticatedRequest extends Request {
  user?: { userId?: string };
}

@Controller('mes/verifications')
export class MesVerificationController {
  constructor(private readonly storage: StorageService) {}

  @Post(':workOrderId/photo')
  @Roles('Admin', 'Supervisor')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(
    @Param('workOrderId') workOrderId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileId = randomUUID();
    const safeName = file.originalname.replace(/[/\\]/g, '_');
    const objectKey = `mes/verifications/${workOrderId}/${fileId}-${safeName}`;

    await this.storage.putObject(objectKey, file.buffer, file.mimetype);

    return {
      photoObjectKey: objectKey,
      photoFileName: file.originalname,
    };
  }

  @Get('photo')
  async downloadPhoto(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const objectKey = req.query['key'];
    if (typeof objectKey !== 'string' || !objectKey) {
      throw new BadRequestException('key query parameter is required');
    }
    const stored = await this.storage.getObject(objectKey);
    res.setHeader('Content-Type', stored.contentType);
    res.send(stored.body);
  }
}
