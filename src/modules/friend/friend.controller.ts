import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FriendService } from './friend.service';
import { AuthGuard } from '@modules/auth/auth.guard';
import {
  FriendCountResponseDto,
  FriendQueryDto,
  FriendReceiverIdDto,
  FriendResponseDto,
  FriendUserResponseDto,
} from '@modules/friend/friend.dto';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { ApiEmptyResponse, ApiWrappedOkResponse } from '@common/swagger/api-response.decorator';
import { UserResponseDto } from '@modules/user/user.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('friends')
@Controller('friends')
export class FriendController {
  constructor(private friendService: FriendService) {}

  @ApiWrappedOkResponse({ type: FriendUserResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  @Get()
  getFriends(@Req() request: Request, @Query() dto: FriendQueryDto) {
    return this.friendService.getFriends(request['user']?.id, dto);
  }

  @ApiWrappedOkResponse({ type: FriendCountResponseDto })
  @UseGuards(AuthGuard)
  @Get('/count')
  getFriendsCount(@Req() request: Request) {
    return this.friendService.getFriendsCount(request['user']?.id);
  }

  @ApiWrappedOkResponse({ type: UserResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  @Get('/suggested')
  getSuggestedUsers(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.friendService.getSuggestedUsers(request['user']?.id, dto);
  }

  @ApiWrappedOkResponse({ type: FriendResponseDto })
  @UseGuards(AuthGuard)
  @Patch('sendRequest/:receiverId')
  sendRequest(@Req() request: Request, @Param('receiverId') receiverId: string) {
    return this.friendService.sendRequest(request['user']?.id, receiverId);
  }

  @ApiEmptyResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @Delete('removeFriend/:requestId')
  removeFriend(@Req() request: Request, @Param('requestId') requestId: string) {
    return this.friendService.removeFriend(request['user']?.id, requestId);
  }

  @ApiWrappedOkResponse({ type: FriendResponseDto })
  @UseGuards(AuthGuard)
  @Put('acceptRequest/:requestId')
  acceptRequest(@Req() request: Request, @Param('requestId') requestId: string) {
    return this.friendService.acceptRequest(request['user']?.id, requestId);
  }

  @ApiWrappedOkResponse({ type: FriendResponseDto })
  @UseGuards(AuthGuard)
  @Put('rejectRequest/:requestId')
  rejectRequest(@Req() request: Request, @Param('requestId') requestId: string) {
    return this.friendService.rejectRequest(request['user']?.id, requestId);
  }
}
