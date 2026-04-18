import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FriendService } from './friend.service';
import { AuthGuard } from '@modules/auth/auth.guard';
import { FriendReceiverIdDto } from '@modules/friend/friend.dto';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';

@Controller('friends')
export class FriendController {
  constructor(private friendService: FriendService) {}

  @UseGuards(AuthGuard)
  @Get()
  getFriends(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.friendService.getFriends(request['user']?.id, dto);
  }

  @UseGuards(AuthGuard)
  @Get('incomingRequests')
  getIncomingRequests(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.friendService.getIncomingRequests(request['user']?.id, dto);
  }

  @UseGuards(AuthGuard)
  @Get('outgoingRequests')
  getOutgoingRequests(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.friendService.getOutgoingRequests(request['user']?.id, dto);
  }

  @UseGuards(AuthGuard)
  @Get('sendRequest/:receiverId')
  sendRequest(@Req() request: Request, @Param('receiverId') receiverId: string) {
    return this.friendService.sendRequest(request['user']?.id, receiverId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @Delete('removeFriend/:friendId')
  removeFriend(@Req() request: Request, @Param('receiverId') friendId: string) {
    return this.friendService.removeFriend(request['user']?.id, friendId);
  }

  @UseGuards(AuthGuard)
  @Put('acceptRequest')
  acceptRequest(@Req() request: Request, @Body() dto: FriendReceiverIdDto) {
    return this.friendService.acceptRequest(request['user']?.id, dto.receiverId);
  }

  @UseGuards(AuthGuard)
  @Put('rejectRequest')
  rejectRequest(@Req() request: Request, @Body() dto: FriendReceiverIdDto) {
    return this.friendService.rejectRequest(request['user']?.id, dto.receiverId);
  }
}
