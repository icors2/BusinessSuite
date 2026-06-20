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
import { DocumentService } from 'plm';
import { StorageService } from 'storage';

interface AuthenticatedRequest extends Request {
  user?: { userId?: string };
}

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly storage: StorageService,
  ) {}

  @Post(':documentId/revisions')
  @Roles('Admin', 'Manager')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadRevision(
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const revisionId = randomUUID();
    const objectKey = this.storage.objectKeyFor(
      documentId,
      revisionId,
      file.originalname,
    );

    await this.storage.putObject(objectKey, file.buffer, file.mimetype);

    const notes =
      typeof req.body?.notes === 'string' ? req.body.notes : undefined;

    const revision = await this.documentService.addRevision(
      documentId,
      {
        revisionId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        objectKey,
        notes,
      },
      req.user?.userId,
    );

    return revision;
  }

  @Get('revisions/:revisionId/download')
  async downloadRevision(
    @Param('revisionId') revisionId: string,
    @Res() res: Response,
  ) {
    const revision = await this.documentService.getRevisionById(revisionId);
    const stored = await this.storage.getObject(revision.objectKey);

    res.setHeader('Content-Type', stored.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(revision.fileName)}"`,
    );
    res.send(stored.body);
  }
}
