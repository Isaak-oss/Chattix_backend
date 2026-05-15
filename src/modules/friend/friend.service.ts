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
import { NotificationService } from '@modules/notification/notification.service';
import { FriendQueryDto, FriendStatusQuery } from '@modules/friend/friend.dto';
import { User } from '@modules/user/user.entity';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';

@Injectable()
export class FriendService {
  constructor(
    @InjectRepository(Friend)
    private friendRepository: Repository<Friend>,
    private notificationService: NotificationService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
      status: FriendStatus.PENDING,
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

  async getFriends(userId: ID, friendQueryDto: FriendQueryDto) {
    const { status, limit, offset } = friendQueryDto;

    const qb = this.friendRepository.createQueryBuilder('friend');

    qb.leftJoinAndSelect('friend.requester', 'requester').leftJoinAndSelect(
      'friend.receiver',
      'receiver',
    );

    if (status === FriendStatusQuery.INCOMING) {
      qb.where('friend.receiverId = :userId', { userId }).andWhere('friend.status = :status', {
        status: FriendStatus.PENDING,
      });
    } else if (status === FriendStatusQuery.OUTGOING) {
      qb.where('friend.requesterId = :userId', { userId }).andWhere('friend.status = :status', {
        status: FriendStatus.PENDING,
      });
    } else {
      qb.where('(friend.requesterId = :userId OR friend.receiverId = :userId)', {
        userId,
      }).andWhere('friend.status = :status', {
        status,
      });
    }

    const { data, meta } = await paginate(qb, { limit, offset });

    const friends = data.map((friend) => {
      const isRequester = friend.requester.id === userId;

      const friendStatus =
        status === FriendStatusQuery.REJECTED
          ? isRequester
            ? 'rejectedByUser'
            : 'rejectedByMe'
          : status;

      return {
        ...(isRequester ? friend.receiver : friend.requester),
        friendStatus,
        friendRequestId: friend.id,
      };
    });

    return {
      data: friends,
      meta,
    };
  }

  async getSuggestedUsers(userId: ID, paginationDto: PaginationDto) {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.id != :userId', { userId })
      .andWhere((subQb) => {
        const subQuery = subQb
          .subQuery()
          .select('1')
          .from(Friend, 'f')
          .where(
            '(f.requesterId = :userId AND f.receiverId = user.id) OR (f.receiverId = :userId AND f.requesterId = user.id)',
          )
          .getQuery();

        return `NOT EXISTS ${subQuery}`;
      })
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'ASC');

    return paginate(qb, paginationDto);
  }

  async getFriendsCount(userId: ID) {
    const result = await this.friendRepository
      .createQueryBuilder('friend')
      .select([
        `COUNT(CASE
          WHEN friend.status = :accepted
          THEN 1
        END) AS friends_count`,
        `COUNT(CASE
          WHEN friend.status = :pending
          AND friend.receiverId = :userId
          THEN 1
        END) AS incoming_count`,
        `COUNT(CASE
          WHEN friend.status = :pending
          AND friend.requesterId = :userId
          THEN 1
        END) AS outgoing_count`,
        `COUNT(CASE
          WHEN friend.status = :rejected
          THEN 1
        END) AS rejected_count`,
      ])
      .where('(friend.requesterId = :userId OR friend.receiverId = :userId)', { userId })
      .setParameters({
        accepted: FriendStatus.ACCEPTED,
        pending: FriendStatus.PENDING,
        rejected: FriendStatus.REJECTED,
      })
      .getRawOne();

    return {
      friends: Number(result.friends_count),
      incoming: Number(result.incoming_count),
      outgoing: Number(result.outgoing_count),
      rejected: Number(result.rejected_count),
    };
  }

  async removeFriend(userId: ID, requestId: ID) {
    const request = await this.friendRepository.findOne({
      where: { id: requestId },
      relations: ['requester', 'receiver'],
    });

    if (!request) {
      throw new NotFoundException();
    }

    const notifyUserId =
      request.requester.id === userId ? request.receiver.id : request.requester.id;
    const relationId = request.id;
    const removedRelation = await this.friendRepository.remove(request);

    this.notificationService.notifyFriendRemoved(notifyUserId, userId, relationId);

    return removedRelation;
  }
}
