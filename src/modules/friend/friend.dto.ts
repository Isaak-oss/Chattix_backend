import { IsString } from 'class-validator';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';

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
