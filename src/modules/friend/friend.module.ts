import { Module } from '@nestjs/common';
import { FriendService } from './friend.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendController } from './friend.controller';
import { Friend } from '@modules/friend/friend.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { User } from '@modules/user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Friend, User]), AuthModule, NotificationModule],
  providers: [FriendService],
  controllers: [FriendController],
  exports: [FriendService],
})
export class FriendModule {}
