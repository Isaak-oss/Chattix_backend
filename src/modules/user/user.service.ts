import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Friend, FriendStatus } from '@modules/friend/friend.entity';
import { UserResponseDto } from '@modules/user/user.dto';
import { RealtimeEventsService } from '@common/gateways/realtime-events.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Friend)
    private friendRepository: Repository<Friend>,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async findOneById(id: ID): Promise<User | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .loadRelationCountAndMap('user.postsCount', 'user.posts')
      .loadRelationCountAndMap('user.friendsCount', 'user.sentRequests', 'friends', (qb) =>
        qb.where('friends.status = :status', {
          status: FriendStatus.ACCEPTED,
        }),
      )
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.withOnlineStatus(user);
  }

  async getProfile(
    userId: ID,
    profileId: ID,
  ): Promise<User & { isFriend: boolean; isOnline: boolean }> {
    const [user, isFriend] = await Promise.all([
      this.userRepository
        .createQueryBuilder('user')
        .loadRelationCountAndMap('user.postsCount', 'user.posts')
        .loadRelationCountAndMap('user.friendsCount', 'user.sentRequests', 'friends', (qb) =>
          qb.where('friends.status = :status', {
            status: FriendStatus.ACCEPTED,
          }),
        )
        .where('user.id = :profileId', { profileId })
        .getOne(),

      this.friendRepository.exist({
        where: [
          {
            requester: { id: userId },
            receiver: { id: profileId },
            status: FriendStatus.ACCEPTED,
          },
          {
            requester: { id: profileId },
            receiver: { id: userId },
            status: FriendStatus.ACCEPTED,
          },
        ],
      }),
    ]);

    if (!user) throw new NotFoundException();

    return {
      ...user,
      isFriend,
      isOnline: this.realtimeEvents.isOnline(user.id),
    };
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.userRepository.create(user);
    return this.userRepository.save(newUser);
  }

  async update(user: Partial<User>): Promise<User> {
    if (!user.id) throw new NotFoundException('User ID is required');

    const updatedUser = await this.userRepository.preload(user);

    if (!updatedUser) throw new NotFoundException('User not found');

    const savedUser = await this.userRepository.save(updatedUser);

    return this.withOnlineStatus(savedUser);
  }

  async findOne(email: string): Promise<UserResponseDto>;
  async findOne(email: string, checkForNotFound: false): Promise<UserResponseDto | null>;
  async findOne(email: string, checkForNotFound?: boolean): Promise<UserResponseDto | null> {
    const shouldThrow = checkForNotFound ?? true;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user && !shouldThrow) {
      return null;
    } else if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.withOnlineStatus(user);
  }

  async getOneWithPassword(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['password', 'email', 'id'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private withOnlineStatus<T extends User>(user: T) {
    return {
      ...user,
      isOnline: this.realtimeEvents.isOnline(user.id),
    };
  }
}
