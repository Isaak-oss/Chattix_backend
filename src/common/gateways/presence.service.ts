import { Injectable, NotFoundException } from '@nestjs/common';
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

type PresenceUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'fullName'
  | 'username'
  | 'bio'
  | 'profileVisibility'
  | 'whoCanMessage'
  | 'lastSeenAt'
  | 'createdAt'
  | 'updatedAt'
>;

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
    const user = await this.updateLastSeenAt(userId, lastSeenAt);
    await this.emitPresenceToFriends(user, true);
  }

  async handleUserDisconnected(userId: ID) {
    const lastSeenAt = new Date();
    const user = await this.updateLastSeenAt(userId, lastSeenAt);
    await this.emitPresenceToFriends(user, false);
  }

  async handleUserOnlineStatusChanged(userId: ID, isOnline: boolean) {
    const changed = this.realtimeEvents.setUserOnline(userId, isOnline);
    const lastSeenAt = new Date();
    const user = await this.updateLastSeenAt(userId, lastSeenAt);
    const effectiveIsOnline = this.realtimeEvents.isOnline(userId);

    if (changed) {
      await this.emitPresenceToFriends(user, effectiveIsOnline);
    }

    return {
      data: {
        ...user,
        isOnline: effectiveIsOnline,
      },
    };
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

  private async emitPresenceToFriends(user: PresenceUser, isOnline: boolean) {
    const friendIds = await this.getAcceptedFriendIds(user.id);

    if (friendIds.length === 0) {
      return;
    }

    this.realtimeEvents.emitToUsers(friendIds, 'friends:presence', {
      data: {
        ...user,
        isOnline,
        lastSeenAt: user.lastSeenAt,
      },
    });
  }

  private async updateLastSeenAt(userId: ID, lastSeenAt: Date): Promise<PresenceUser> {
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ lastSeenAt })
      .where('id = :userId', { userId })
      .execute();

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'fullName',
        'username',
        'bio',
        'profileVisibility',
        'whoCanMessage',
        'lastSeenAt',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user as PresenceUser;
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
