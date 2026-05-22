import { Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { AuthGuard } from '@modules/auth/auth.guard';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(AuthGuard)
  @Get()
  getMyNotifications(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.notificationService.getMyNotifications(request['user']?.id, dto);
  }

  @UseGuards(AuthGuard)
  @Get('/count')
  getMyNotificationsCount(@Req() request: Request) {
    return this.notificationService.getNotificationsCount(request['user']?.id);
  }

  @UseGuards(AuthGuard)
  @Patch(':id/read')
  markAsRead(@Req() request: Request, @Param('id') id: string) {
    return this.notificationService.markAsRead(request['user']?.id, id);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.notificationService.deleteMyNotification(id);
  }
}
