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
import { NotificationService } from '@modules/notification/notification.service';

@Injectable()
export class FriendService {
  constructor(
    @InjectRepository(Friend)
    private friendRepository: Repository<Friend>,
    private notificationService: NotificationService,
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

    const savedFriend = await this.friendRepository.save(friend);

    this.notificationService.notifyFriendRequest(receiverId, requesterId, savedFriend.id);

    return savedFriend;
  }

  async acceptRequest(requesterId: ID, requestId: ID) {
    const request = await this.friendRepository.findOne({
      where: { id: requestId },
      relations: ['requester', 'receiver'],
    });

    if (!request) throw new NotFoundException();

    if (request.receiver.id !== requesterId) {
      throw new ForbiddenException();
    }

    request.status = FriendStatus.ACCEPTED;

    const savedRequest = await this.friendRepository.save(request);

    this.notificationService.notifyFriendAccepted(
      savedRequest.requester.id,
      savedRequest.receiver.id,
      savedRequest.id,
    );

    return savedRequest;
  }

  async rejectRequest(requesterId: ID, requestId: ID) {
    const request = await this.friendRepository.findOne({
      where: { id: requestId },
      relations: ['requester', 'receiver'],
    });

    if (!request) throw new NotFoundException();

    if (request.receiver.id !== requesterId) {
      throw new ForbiddenException();
    }

    request.status = FriendStatus.REJECTED;

    const savedRequest = await this.friendRepository.save(request);

    this.notificationService.notifyFriendRejected(
      savedRequest.requester.id,
      savedRequest.receiver.id,
      savedRequest.id,
    );

    return savedRequest;
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
      relations: ['requester', 'receiver'],
    });

    if (!relation) {
      throw new NotFoundException();
    }

    const notifyUserId = relation.requester.id === userId ? relation.receiver.id : relation.requester.id;
    const relationId = relation.id;
    const removedRelation = await this.friendRepository.remove(relation);

    this.notificationService.notifyFriendRemoved(notifyUserId, userId, relationId);

    return removedRelation;
  }
}
