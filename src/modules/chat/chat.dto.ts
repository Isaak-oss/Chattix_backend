import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@modules/user/user.dto';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class ConversationParamsDto {
  @IsString()
  userId: ID;
}

export class ChatRoomParamsDto {
  @IsString()
  roomId: ID;
}

export class MarkChatRoomReadDto {
  @IsOptional()
  @IsString()
  lastReadMessageId?: ID;
}

export class CreateChatRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds: ID[];

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  firstMessage: string;
}

export class ChatRoomReadResponseDto {
  @ApiProperty()
  id: ID;

  @ApiProperty()
  chatRoomId: ID;

  @ApiProperty()
  userId: ID;

  @ApiProperty({ required: false })
  lastReadMessageId?: ID;

  @ApiProperty({ required: false })
  lastReadAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ChatRoomResponseDto {
  @ApiProperty()
  id: ID;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ type: () => [UserResponseDto] })
  participants: UserResponseDto[];

  @ApiProperty({ type: () => [ChatRoomReadResponseDto], required: false })
  readStates?: ChatRoomReadResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class MessageResponseDto {
  @ApiProperty()
  id: ID;

  @ApiProperty()
  content: string;

  @ApiProperty()
  chatRoomId: ID;

  @ApiProperty({ type: () => ChatRoomResponseDto, required: false })
  chatRoom?: ChatRoomResponseDto;

  @ApiProperty()
  senderId: ID;

  @ApiProperty({ type: () => UserResponseDto, required: false })
  sender?: UserResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ChatRoomWithFirstMessageResponseDto extends ChatRoomResponseDto {
  @ApiProperty({ type: () => MessageResponseDto })
  firstMessage: MessageResponseDto;
}

export class UnreadMessagesResponseDto {
  @ApiProperty()
  unreadMessages: number;
}
