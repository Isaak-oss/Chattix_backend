import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiWrappedOkResponse } from '@common/swagger/api-response.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiWrappedOkResponse({ schema: { type: 'string' } })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
