import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './post.entity';
import { paginate } from '@common/lib/paginate/paginate';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { CreatePostDto } from './post.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
  ) {}

  getAllFeed(paginationDto: PaginationDto) {
    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .orderBy('post.createdAt', 'DESC');
    return paginate(qb, paginationDto);
  }

  getMyPosts(userId: ID, paginationDto: PaginationDto) {
    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.authorId = :userId', { userId })
      .orderBy('post.createdAt', 'DESC');
    return paginate(qb, paginationDto);
  }

  async create(createPostDto: CreatePostDto, userId: ID) {
    const post = this.postRepository.create({ ...createPostDto, authorId: userId });
    const newPost = await this.postRepository.save(post);
    return this.findOne(newPost.id);
  }

  async update(id: ID, createPostDto: CreatePostDto) {
    const post = await this.findOne(id);
    Object.assign(post, createPostDto);
    return this.postRepository.save(post);
  }

  async remove(id: ID) {
    const post = await this.findOne(id);
    return this.postRepository.remove(post);
  }

  async findOne(postId: ID) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['author'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }
}
