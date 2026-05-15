import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserController } from './user.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthTokenService } from '@modules/auth/auth-token.service';
import { Friend } from '@modules/friend/friend.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Friend]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        global: true,
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: '365d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [UserService, AuthTokenService],
  controllers: [UserController],
  exports: [UserService, AuthTokenService, JwtModule],
})
export class UserModule {}
