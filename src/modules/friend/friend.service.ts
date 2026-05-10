import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friend, FriendStatus } from '@modules/friend/friend.entity';
import { paginate } from '@common/lib/paginate/paginate';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';

@Injectable()
export class FriendService {
  constructor(
    @InjectRepository(Friend)
    private friendRepository: Repository<Friend>,
  ) {}

  async sendRequest(requesterId: ID, receiverId: ID) {
    if (requesterId === receiverId) {
      throw new BadRequestException("You can't add yourself");
    }

    const existing = await this.friendRepository.findOne({
      where: [
        {
          requester: { id: requesterId },
          receiver: { id: receiverId },
        },
        {
          requester: { id: receiverId },
          receiver: { id: requesterId },
        },
      ],
    });

    if (existing) {
      throw new BadRequestException('The application already exists');
    }

    const friend = this.friendRepository.create({
      requester: { id: requesterId },
      receiver: { id: receiverId },
    });

    return this.friendRepository.save(friend);
  }

  async acceptRequest(requesterId: ID, requestId: ID) {
    const request = await this.friendRepository.findOne({
      where: { id: requestId },
      relations: ['receiver'],
    });

    if (!request) throw new NotFoundException();

    if (request.receiver.id !== requesterId) {
      throw new ForbiddenException();
    }

    request.status = FriendStatus.ACCEPTED;

    return this.friendRepository.save(request);
  }

  async rejectRequest(requesterId: ID, requestId: ID) {
    const request = await this.friendRepository.findOne({
      where: { id: requestId },
      relations: ['receiver'],
    });

    if (!request) throw new NotFoundException();

    if (request.receiver.id !== requesterId) {
      throw new ForbiddenException();
    }

    request.status = FriendStatus.REJECTED;

    return this.friendRepository.save(request);
  }

  async getFriends(userId: ID, paginationDto: PaginationDto) {
    const qb = this.friendRepository
      .createQueryBuilder('friend')
      .leftJoinAndSelect('friend.requester', 'requester')
      .leftJoinAndSelect('friend.receiver', 'receiver')
      .where('(friend.requesterId = :userId OR friend.receiverId = :userId)', { userId })
      .andWhere('friend.status = :status', { status: 'accepted' });

    const { data, meta } = await paginate(qb, paginationDto);

    const friends = data.map((f) => (f.requester.id === userId ? f.receiver : f.requester));

    return { data: friends, meta };
  }

  async getIncomingRequests(userId: ID, paginationDto: PaginationDto) {
    const qb = this.friendRepository
      .createQueryBuilder('friend')
      .leftJoinAndSelect('friend.requester', 'requester')
      .where('friend.receiverId = :userId', { userId })
      .andWhere('friend.status = :status', { status: 'pending' });

    return paginate(qb, paginationDto);
  }

  async getOutgoingRequests(userId: ID, paginationDto: PaginationDto) {
    const qb = this.friendRepository
      .createQueryBuilder('friend')
      .leftJoinAndSelect('friend.receiver', 'receiver')
      .where('friend.requesterId = :userId', { userId })
      .andWhere('friend.status = :status', { status: 'pending' });

    return paginate(qb, paginationDto);
  }

  async removeFriend(userId: ID, friendId: ID) {
    const relation = await this.friendRepository.findOne({
      where: [
        {
          requester: { id: userId },
          receiver: { id: friendId },
        },
        {
          requester: { id: friendId },
          receiver: { id: userId },
        },
      ],
    });

    if (!relation) {
      throw new NotFoundException();
    }

    return this.friendRepository.remove(relation);
  }
}
