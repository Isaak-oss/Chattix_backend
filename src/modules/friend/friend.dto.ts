import { IsString } from 'class-validator';

export class FriendReceiverIdDto {
  @IsString()
  receiverId: ID;
}
