import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LogoutResponseDto,
  SignInDto,
  SignInResponseDto,
  SignInWithGoogleDto,
  SignUpDto,
} from './auth.dto';
import { SetAccessTokenInterceptor } from '@common/interceptors/cookie.interceptor';
import { ApiWrappedCreatedResponse } from '@common/swagger/api-response.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@UseInterceptors(SetAccessTokenInterceptor)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiWrappedCreatedResponse({ type: SignInResponseDto })
  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @ApiWrappedCreatedResponse({ type: SignInResponseDto })
  @Post('register')
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @ApiWrappedCreatedResponse({ type: LogoutResponseDto })
  @Post('logout')
  logout() {
    return { success: true, logout: true };
  }

  @ApiWrappedCreatedResponse({ type: SignInResponseDto })
  @Post('reset-password')
  resetPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.resetPassword(forgotPasswordDto);
  }

  @ApiWrappedCreatedResponse({ type: SignInResponseDto })
  @Post('signInWithGoogle')
  signInWithGoogle(@Body() body: SignInWithGoogleDto) {
    return this.authService.signInWithGoogle(body.googleToken);
  }
}
