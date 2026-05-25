import { IsString } from 'class-validator';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@modules/user/user.dto';
import { FriendStatus } from '@modules/friend/friend.entity';

export enum FriendStatusQuery {
  ACCEPTED = 'accepted',
  OUTGOING = 'outgoing',
  INCOMING = 'incoming',
  REJECTED = 'rejected',
}

export class FriendReceiverIdDto {
  @IsString()
  receiverId: ID;
}

export class FriendQueryDto extends PaginationDto {
  @IsString()
  status: FriendStatusQuery;
}

export class FriendUserResponseDto extends UserResponseDto {
  @ApiProperty()
  friendStatus: string;

  @ApiProperty()
  friendRequestId: ID;
}

export class FriendCountResponseDto {
  @ApiProperty()
  friends: number;

  @ApiProperty()
  incoming: number;

  @ApiProperty()
  outgoing: number;

  @ApiProperty()
  rejected: number;
}

export class FriendResponseDto {
  @ApiProperty()
  id: ID;

  @ApiProperty({ type: () => UserResponseDto })
  requester: UserResponseDto;

  @ApiProperty({ type: () => UserResponseDto })
  receiver: UserResponseDto;

  @ApiProperty({ enum: FriendStatus })
  status: FriendStatus;

  @ApiProperty()
  createdAt: Date;
}
