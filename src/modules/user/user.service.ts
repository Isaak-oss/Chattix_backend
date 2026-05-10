import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { FriendStatus } from '@modules/friend/friend.entity';
import { UserResponseDto } from '@modules/user/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findOneById(id: string): Promise<User | null> {
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

    return user;
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.userRepository.create(user);
    return this.userRepository.save(newUser);
  }

  async update(user: Partial<User>): Promise<User> {
    if (!user.id) throw new NotFoundException('User ID is required');

    const updatedUser = await this.userRepository.preload(user);

    if (!updatedUser) throw new NotFoundException('User not found');

    return this.userRepository.save(updatedUser);
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

    return user;
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
}
