import { Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { AuthGuard } from '@modules/auth/auth.guard';
import { NotificationService } from './notification.service';
import {
  DeleteNotificationResponseDto,
  NotificationCountResponseDto,
  NotificationResponseDto,
} from './notification.types';
import { ApiWrappedOkResponse } from '@common/swagger/api-response.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiWrappedOkResponse({ type: NotificationResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  @Get()
  getMyNotifications(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.notificationService.getMyNotifications(request['user']?.id, dto);
  }

  @ApiWrappedOkResponse({ type: NotificationCountResponseDto })
  @UseGuards(AuthGuard)
  @Get('/count')
  getMyNotificationsCount(@Req() request: Request) {
    return this.notificationService.getNotificationsCount(request['user']?.id);
  }

  @ApiWrappedOkResponse({ type: NotificationResponseDto })
  @UseGuards(AuthGuard)
  @Patch(':id/read')
  markAsRead(@Req() request: Request, @Param('id') id: string) {
    return this.notificationService.markAsRead(request['user']?.id, id);
  }

  @ApiWrappedOkResponse({ type: DeleteNotificationResponseDto })
  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.notificationService.deleteMyNotification(id);
  }
}
