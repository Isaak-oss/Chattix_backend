import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@modules/user/user.dto';

export class CreatePostDto {
  @IsString()
  content: string;
}

export class PostResponseDto {
  @ApiProperty()
  id: ID;

  @ApiProperty({ nullable: true })
  content: string;

  @ApiProperty()
  isPublished: boolean;

  @ApiProperty({ type: () => UserResponseDto })
  author: UserResponseDto;

  @ApiProperty()
  authorId: ID;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
