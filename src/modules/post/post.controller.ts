import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PostService } from './post.service';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { CreatePostDto } from '@modules/post/post.dto';
import { AuthGuard } from '@modules/auth/auth.guard';

@Controller('post')
export class PostController {
  constructor(private postService: PostService) {}

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @Get('getMyPosts')
  getMyPosts(@Req() request: Request, @Query() dto: PaginationDto) {
    return this.postService.getMyPosts(request['user']?.id, dto);
  }

  @UseGuards(AuthGuard)
  @Get('/getFeed')
  getAllFeed(@Query() dto: PaginationDto) {
    return this.postService.getAllFeed(dto);
  }

  @UseGuards(AuthGuard)
  @Post()
  async create(@Body() dto: CreatePostDto, @Req() request: Request) {
    const post = await this.postService.create(dto, request['user']?.id);
    return { data: post };
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: CreatePostDto) {
    const post = await this.postService.update(id, dto);
    return { data: post };
  }

  @HttpCode(HttpStatus.NO_CONTENT) // 204
  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.postService.remove(id);
  }
}
