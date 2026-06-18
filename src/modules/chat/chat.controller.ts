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
  CreateGroupChatRoomDto,
  RoomMessagesQueryDto,
} from './chat.dto';
import { ChatService } from './chat.service';
import {
  ApiEmptyResponse,
  ApiWrappedCreatedResponse,
  ApiWrappedOkResponse,
} from '@common/swagger/api-response.decorator';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('chats')
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({
    summary: 'Create or reuse a direct chat room',
    description:
      'Creates a direct chat with the recipient, or reuses the existing direct room for the same user pair, then sends the first message.',
  })
  @ApiWrappedCreatedResponse({ type: ChatRoomWithFirstMessageResponseDto })
  @UseGuards(AuthGuard)
  @Post('rooms')
  async createRoom(@Req() request: Request, @Body() dto: CreateChatRoomDto) {
    const room = await this.chatService.createRoom(request['user']?.id, dto);
    return { data: room };
  }

  @ApiOperation({
    summary: 'Create a group chat room',
    description:
      'Creates a group room with the authenticated user and the provided participant ids, then sends the first message.',
  })
  @ApiWrappedCreatedResponse({ type: ChatRoomWithFirstMessageResponseDto })
  @UseGuards(AuthGuard)
  @Post('groupRooms')
  async createGroupRoom(@Req() request: Request, @Body() dto: CreateGroupChatRoomDto) {
    const room = await this.chatService.createGroupRoom(request['user']?.id, dto);
    return { data: room };
  }

  @ApiOperation({
    summary: 'List my chat rooms',
    description:
      'Returns rooms where the authenticated user is a participant, ordered by activity.',
  })
  @ApiWrappedOkResponse({ type: ChatRoomResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  @Get('rooms')
  getMyRooms(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.chatService.getMyRooms(request['user']?.id, dto);
  }

  @ApiOperation({ summary: 'Get chat room by id' })
  @ApiParam({
    name: 'roomId',
    description: 'Chat room id.',
    example: '6d0d13e3-b31f-44d9-91c6-8d937ff3d9a5',
  })
  @ApiWrappedOkResponse({ type: ChatRoomResponseDto })
  @UseGuards(AuthGuard)
  @Get('rooms/:roomId')
  async getRoom(@Req() request: Request, @Param() params: ChatRoomParamsDto) {
    const room = await this.chatService.getRoom(request['user']?.id, params.roomId);
    return { data: room };
  }

  @ApiOperation({ summary: 'Get unread messages count' })
  @ApiWrappedOkResponse({ type: UnreadMessagesResponseDto })
  @UseGuards(AuthGuard)
  @Get('unreadMessages')
  getUnreadMessages(@Req() request: Request) {
    return this.chatService.getUnreadMessages(request['user']?.id);
  }

  @ApiOperation({ summary: 'List room messages' })
  @ApiParam({
    name: 'roomId',
    description: 'Chat room id.',
    example: '6d0d13e3-b31f-44d9-91c6-8d937ff3d9a5',
  })
  @ApiWrappedOkResponse({ type: MessageResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  @Get('rooms/:roomId/messages')
  getRoomMessages(
    @Req() request: Request,
    @Param() params: ChatRoomParamsDto,
    @Query() dto: RoomMessagesQueryDto,
  ) {
    return this.chatService.getRoomMessages(request['user']?.id, params.roomId, dto);
  }

  @ApiOperation({
    summary: 'Mark a room as read',
    description:
      'Marks the room read through the latest message, or through lastReadMessageId when provided.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'Chat room id.',
    example: '6d0d13e3-b31f-44d9-91c6-8d937ff3d9a5',
  })
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

  @ApiOperation({ summary: 'Send a message to a room' })
  @ApiParam({
    name: 'roomId',
    description: 'Chat room id.',
    example: '6d0d13e3-b31f-44d9-91c6-8d937ff3d9a5',
  })
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

  @ApiOperation({ summary: 'Mark a message as read' })
  @ApiParam({
    name: 'id',
    description: 'Message id.',
    example: '7b4f0ac0-5e96-4e7c-8b4b-96a1d8b82294',
  })
  @ApiWrappedOkResponse({ type: ChatRoomReadResponseDto })
  @UseGuards(AuthGuard)
  @Patch(':id/read')
  async markAsRead(@Req() request: Request, @Param('id') id: string) {
    const message = await this.chatService.markAsRead(request['user']?.id, id);
    return { data: message };
  }

  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({
    name: 'id',
    description: 'Message id.',
    example: '7b4f0ac0-5e96-4e7c-8b4b-96a1d8b82294',
  })
  @ApiEmptyResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@Req() request: Request, @Param('id') id: string) {
    await this.chatService.remove(request['user']?.id, id);
  }
}
