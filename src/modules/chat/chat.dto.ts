import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
