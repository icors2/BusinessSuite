import { Controller, Get } from '@nestjs/common';
import { Public } from 'auth';

@Controller()
export class AppController {
  @Public()
  @Get()
  getRoot() {
    return {
      name: 'Arc N Code Business Suite API',
      version: '0.1.0',
      phase: 0,
    };
  }
}
