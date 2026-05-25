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
  ChatRoomParamsDto,
  CreateChatRoomDto,
  CreateMessageDto,
  MarkChatRoomReadDto,
} from './chat.dto';
import { ChatService } from './chat.service';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(AuthGuard)
  @Post('rooms')
  async createRoom(@Req() request: Request, @Body() dto: CreateChatRoomDto) {
    const room = await this.chatService.createRoom(request['user']?.id, dto);
    return { data: room };
  }

  @UseGuards(AuthGuard)
  @Get('rooms')
  getMyRooms(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.chatService.getMyRooms(request['user']?.id, dto);
  }

  @UseGuards(AuthGuard)
  @Get('unreadMessages')
  getUnreadMessages(@Req() request: Request) {
    return this.chatService.getUnreadMessages(request['user']?.id);
  }

  @UseGuards(AuthGuard)
  @Get('rooms/:roomId/messages')
  getRoomMessages(
    @Req() request: Request,
    @Param() params: ChatRoomParamsDto,
    @Query() dto: PaginationDto,
  ) {
    return this.chatService.getRoomMessages(request['user']?.id, params.roomId, dto);
  }

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

  @UseGuards(AuthGuard)
  @Patch(':id/read')
  async markAsRead(@Req() request: Request, @Param('id') id: string) {
    const message = await this.chatService.markAsRead(request['user']?.id, id);
    return { data: message };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@Req() request: Request, @Param('id') id: string) {
    await this.chatService.remove(request['user']?.id, id);
  }
}
