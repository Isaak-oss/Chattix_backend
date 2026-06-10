import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from '@modules/user/user.dto';
import { ChatRoomType } from './chat-room.entity';

export class CreateMessageDto {
  @ApiProperty({
    example: 'Hello!',
    minLength: 1,
    maxLength: 5000,
    description: 'Message text.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class ChatRoomParamsDto {
  @ApiProperty({
    example: '6d0d13e3-b31f-44d9-91c6-8d937ff3d9a5',
    description: 'Chat room id.',
  })
  @IsString()
  roomId: ID;
}

export class MarkChatRoomReadDto {
  @ApiPropertyOptional({
    example: '7b4f0ac0-5e96-4e7c-8b4b-96a1d8b82294',
    description: 'Last message id the user has read. If omitted, the whole room is marked read.',
  })
  @IsOptional()
  @IsString()
  lastReadMessageId?: ID;
}

export class CreateChatRoomDto {
  @ApiProperty({
    example: '2bf8f28d-7df6-42e9-b0e9-ecf8f61d43f3',
    description: 'Recipient user id. Existing direct room for the same pair will be reused.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  to: ID;

  @ApiProperty({
    example: 'Hey, are you available today?',
    minLength: 1,
    maxLength: 5000,
    description: 'First message to send into the direct chat.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  firstMessage: string;
}

export class CreateGroupChatRoomDto {
  @ApiPropertyOptional({
    example: 'Project launch',
    maxLength: 120,
    description: 'Optional group chat name. Empty strings are stored as no name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({
    type: String,
    isArray: true,
    minItems: 1,
    example: ['2bf8f28d-7df6-42e9-b0e9-ecf8f61d43f3', '8dfd5e94-b6f9-4cd2-bf6b-5e41040fb14d'],
    description: 'Participant user ids. The authenticated user is added automatically.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds: ID[];

  @ApiProperty({
    example: 'Welcome to the group.',
    minLength: 1,
    maxLength: 5000,
    description: 'First message to send into the group chat.',
  })
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

  @ApiProperty({
    enum: ChatRoomType,
    example: ChatRoomType.DIRECT,
    description: 'Chat room type: direct one-on-one chat or group chat.',
  })
  type: ChatRoomType;

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
