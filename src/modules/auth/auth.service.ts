import { BadRequestException, Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ForgotPasswordDto, SignInDto, SignInResponseDto, SignUpDto } from './auth.dto';
import { User } from '../user/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  private issueToken(user: User): SignInResponseDto {
    const payload = { id: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async signIn(signInDto: SignInDto & { withOutPassword?: boolean }) {
    const { email, password, withOutPassword } = signInDto;

    const user = await this.userService.getOneWithPassword(email);

    if (!user) {
      throw new BadRequestException('Credentials do not match');
    }

    if (!withOutPassword && !user.password) {
      // --- Google account verification ---
      throw new BadRequestException('Account registered with Google');
    }

    // --- Password verification ---
    if (!withOutPassword) {
      if (!!password && !!user.password) {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          throw new BadRequestException('Credentials do not match');
        }
      } else {
        throw new BadRequestException('Credentials do not match');
      }
    }

    return this.issueToken(user);
  }

  async signUp(signUpDto: SignUpDto & { withOutPassword?: boolean }) {
    const { email, password, withOutPassword, ...rest } = signUpDto;
    const hasUser = await this.userService.findOne(email, false);

    if (hasUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const userFields = { email, ...rest };

    if (withOutPassword) {
      const user = await this.userService.create({
        ...userFields,
        password: undefined,
      });

      return this.issueToken(user);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await this.userService.create({
        ...userFields,
        password: !withOutPassword ? hashedPassword : undefined,
      });

      return this.issueToken(user);
    }

    throw new BadRequestException('Fill all of the fields');
  }

  async signInWithGoogle(googleToken: string) {
    // get google confirmation
    const { email: emailByGoogleToken, name: nameByGoogleToken } =
      await this.googleAuthService(googleToken);
    const hasUser = await this.userService.findOne(emailByGoogleToken, false);
    if (!hasUser) {
      await this.signUp({
        email: emailByGoogleToken,
        withOutPassword: true,
        name: nameByGoogleToken,
      });
    }
    return this.signIn({
      email: emailByGoogleToken,
      password: undefined,
      withOutPassword: true,
    });
  }

  private async googleAuthService(googleToken: string) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        method: 'GET',
        headers: { Authorization: `Bearer ${googleToken}` },
      });

      if (!response.ok) {
        throw new Error('Error Google API');
      }

      const data = await response.json();
      return { email: data?.email, name: data?.name };
    } catch (error) {
      console.error('Ошибка:', error);
      throw error;
    }
  }

  async resetPassword(dto: ForgotPasswordDto) {
    const { email, newPassword, oldPassword } = dto;

    const user = await this.userService.findOne(email);

    if (user.password) {
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

      if (!isPasswordValid) {
        throw new BadRequestException('Credentials do not match');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await this.userService.update({
        ...user,
        password: hashedPassword,
      });

      return this.issueToken(user);
    } else {
      throw new BadRequestException('Your account was created by OAuth Service (Google or other)');
    }
  }
}
