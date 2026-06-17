import { Global, Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Friend } from '@modules/friend/friend.entity';
import { User } from '@modules/user/user.entity';
import { PresenceService } from './presence.service';
import { RealtimeEventsService } from './realtime-events.service';
import { RealtimeGateway } from './realtime.gateway';

@Global()
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Friend, User])],
  providers: [RealtimeEventsService, PresenceService, RealtimeGateway],
  exports: [RealtimeEventsService, PresenceService],
})
export class RealtimeModule {}
