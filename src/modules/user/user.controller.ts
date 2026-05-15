import {
  Body,
  Controller,
  Get, Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ChangeUserDto } from '@modules/user/user.dto';
import { AuthGuard } from '@modules/auth/auth.guard';

@Controller('user')
export class UserController {
  constructor(private usersService: UserService) {}

  @UseGuards(AuthGuard)
  @Get('me')
  getMe(@Req() request: Request) {
    return this.usersService.findOne(request['user']?.email);
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  update(@Req() request: Request, @Body() dto: ChangeUserDto) {
    console.log(request['user']);
    return this.usersService.update({
      ...dto,
      ...request['user'],
    });
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  getProfile(@Req() request: Request, @Param('id') id: string) {
    return this.usersService.getProfile(request['user']?.id, id);
  }
}
