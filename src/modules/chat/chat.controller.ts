import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { AuthGuard } from '@modules/auth/auth.guard';
import {
  ChatRoomReadResponseDto,
  ChatRoomParamsDto,
  ChatRoomResponseDto,
  CreateChatRoomDto,
  CreateMessageDto,
  ChatRoomWithFirstMessageResponseDto,
  MarkChatRoomReadDto,
  MessageResponseDto,
  UnreadMessagesResponseDto,
} from './chat.dto';
import { ChatService } from './chat.service';
import {
  ApiEmptyResponse,
  ApiWrappedCreatedResponse,
  ApiWrappedOkResponse,
} from '@common/swagger/api-response.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('chats')
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiWrappedCreatedResponse({ type: ChatRoomWithFirstMessageResponseDto })
  @UseGuards(AuthGuard)
  @Post('rooms')
  async createRoom(@Req() request: Request, @Body() dto: CreateChatRoomDto) {
    const room = await this.chatService.createRoom(request['user']?.id, dto);
    return { data: room };
  }

  @ApiWrappedOkResponse({ type: ChatRoomResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  @Get('rooms')
  getMyRooms(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.chatService.getMyRooms(request['user']?.id, dto);
  }

  @ApiWrappedOkResponse({ type: UnreadMessagesResponseDto })
  @UseGuards(AuthGuard)
  @Get('unreadMessages')
  getUnreadMessages(@Req() request: Request) {
    return this.chatService.getUnreadMessages(request['user']?.id);
  }

  @ApiWrappedOkResponse({ type: MessageResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  @Get('rooms/:roomId/messages')
  getRoomMessages(
    @Req() request: Request,
    @Param() params: ChatRoomParamsDto,
    @Query() dto: PaginationDto,
  ) {
    return this.chatService.getRoomMessages(request['user']?.id, params.roomId, dto);
  }

  @ApiWrappedOkResponse({ type: ChatRoomReadResponseDto })
  @UseGuards(AuthGuard)
  @Patch('rooms/:roomId/read')
  async markRoomAsRead(
    @Req() request: Request,
    @Param() params: ChatRoomParamsDto,
    @Body() dto: MarkChatRoomReadDto,
  ) {
    const readState = await this.chatService.markRoomReadState(
      request['user']?.id,
      params.roomId,
      dto.lastReadMessageId,
    );
    return { data: readState };
  }

  @ApiWrappedCreatedResponse({ type: MessageResponseDto })
  @UseGuards(AuthGuard)
  @Post('rooms/:roomId/messages')
  async sendMessage(
    @Req() request: Request,
    @Body() dto: CreateMessageDto,
    @Param() params: ChatRoomParamsDto,
  ) {
    const message = await this.chatService.sendMessage(request['user']?.id, params.roomId, dto);
    return { data: message };
  }

  @ApiWrappedOkResponse({ type: ChatRoomReadResponseDto })
  @UseGuards(AuthGuard)
  @Patch(':id/read')
  async markAsRead(@Req() request: Request, @Param('id') id: string) {
    const message = await this.chatService.markAsRead(request['user']?.id, id);
    return { data: message };
  }

  @ApiEmptyResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@Req() request: Request, @Param('id') id: string) {
    await this.chatService.remove(request['user']?.id, id);
  }
}
