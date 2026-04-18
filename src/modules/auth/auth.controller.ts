import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  SignInDto,
  SignInWithGoogleDto,
  SignUpDto,
} from './auth.dto';
import { SetAccessTokenInterceptor } from '@common/interceptors/cookie.interceptor';

@UseInterceptors(SetAccessTokenInterceptor)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Post('register')
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('logout')
  logout() {
    return { success: true, logout: true };
  }

  @Post('reset-password')
  resetPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.resetPassword(forgotPasswordDto);
  }

  @Post('signInWithGoogle')
  signInWithGoogle(@Body() body: SignInWithGoogleDto) {
    return this.authService.signInWithGoogle(body.googleToken);
  }
}
