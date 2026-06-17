import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Friend, FriendStatus } from '@modules/friend/friend.entity';
import { User } from '@modules/user/user.entity';
import { In, Repository } from 'typeorm';
import { RealtimeEventsService } from './realtime-events.service';

export type FriendPresenceDto = {
  userId: ID;
  isOnline: boolean;
  lastSeenAt: Date;
};

@Injectable()
export class PresenceService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async handleUserConnected(userId: ID) {
    const lastSeenAt = new Date();
    await this.userRepository.update(userId, { lastSeenAt });
    await this.emitPresenceToFriends(userId, true, lastSeenAt);
  }

  async handleUserDisconnected(userId: ID) {
    const lastSeenAt = new Date();
    await this.userRepository.update(userId, { lastSeenAt });
    await this.emitPresenceToFriends(userId, false, lastSeenAt);
  }

  async getFriendsOnlineStatus(userId: ID) {
    const friendIds = await this.getAcceptedFriendIds(userId);
    if (friendIds.length === 0) {
      return [];
    }

    const users = await this.userRepository.find({
      where: { id: In(friendIds) },
      select: ['id', 'lastSeenAt'],
    });

    return users.map((user) => this.createPresencePayload(user.id, user.lastSeenAt));
  }

  private async emitPresenceToFriends(userId: ID, isOnline: boolean, lastSeenAt: Date) {
    const friendIds = await this.getAcceptedFriendIds(userId);
    if (friendIds.length === 0) {
      return;
    }

    this.realtimeEvents.emitToUsers(friendIds, 'friends:presence', {
      data: {
        userId,
        isOnline,
        lastSeenAt,
      },
    });
  }

  private createPresencePayload(userId: ID, lastSeenAt: Date): FriendPresenceDto {
    return {
      userId,
      isOnline: this.realtimeEvents.isOnline(userId),
      lastSeenAt,
    };
  }

  private async getAcceptedFriendIds(userId: ID) {
    const rows = await this.friendRepository
      .createQueryBuilder('friend')
      .select(
        `CASE
          WHEN "friend"."requesterId" = :userId THEN "friend"."receiverId"
          ELSE "friend"."requesterId"
        END`,
        'userId',
      )
      .where('(friend.requesterId = :userId OR friend.receiverId = :userId)', { userId })
      .andWhere('friend.status = :status', { status: FriendStatus.ACCEPTED })
      .getRawMany<{ userId: ID }>();

    return rows.map((row) => row.userId);
  }
}
