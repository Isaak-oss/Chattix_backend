import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@modules/auth/auth.module';
import { RealtimeModule } from '@common/gateways/realtime.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatRoom } from './chat-room.entity';
import { ChatRoomRead } from './chat-room-read.entity';
import { Message } from './message.entity';
import { ChatService } from './chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, ChatRoom, ChatRoomRead]),
    AuthModule,
    RealtimeModule,
  ],
  providers: [ChatService, ChatGateway],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
