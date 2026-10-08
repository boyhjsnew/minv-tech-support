import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { AuthService, AuthWorkflowError } from './auth.service';
import {
  ContactsByTaxCodesDto,
  LoginByTaxCodeDto,
  LoginDto,
} from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /** Chỉ nhập MST: CRM → ResetPasswordNewApp → login .minvoice.net → cookies */
  @Post('login-by-tax-code')
  async loginByTaxCode(@Body() dto: LoginByTaxCodeDto) {
    if (!dto?.taxCode?.trim()) {
      throw new HttpException('taxCode là bắt buộc', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.authService.loginByTaxCode(dto);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed';
      const step = e instanceof AuthWorkflowError ? e.step : 'UNKNOWN';
      this.logger.error(
        `login-by-tax-code taxCode=${dto.taxCode} step=${step}: ${message}`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          error: 'Bad Gateway',
          step,
          message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** Danh sách MST → email/phone tờ khai mới nhất; tái sử dụng CRM token/session */
  @Post('contacts-by-tax-codes')
  async contactsByTaxCodes(@Body() dto: ContactsByTaxCodesDto) {
    if (!Array.isArray(dto?.taxCodes) || !dto.taxCodes.length) {
      throw new HttpException(
        'taxCodes phải là danh sách có ít nhất một MST',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.authService.contactsByTaxCodes(dto);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Batch failed';
      const step = e instanceof AuthWorkflowError ? e.step : 'UNKNOWN';
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          error: 'Bad Gateway',
          step,
          message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * POST /auth/login
   * body: { taxCode, username, password, rememberMe?, requestVerificationToken?, baseHost? }
   */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    if (!dto?.taxCode?.trim()) {
      throw new HttpException('taxCode là bắt buộc', HttpStatus.BAD_REQUEST);
    }
    if (!dto?.username?.trim() || !dto?.password) {
      throw new HttpException(
        'username và password là bắt buộc',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.authService.login(dto);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  /** GET /auth/sessions/:id/cookies */
  @Get('sessions/:id/cookies')
  async getCookies(@Param('id') id: string) {
    const data = await this.authService.getCookies(id);
    if (!data) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return data;
  }

  /** GET tờ khai mới nhất và trả email/phone */
  @Get('sessions/:id/latest-declaration-contact')
  async getLatestDeclarationContact(@Param('id') id: string) {
    try {
      return await this.authService.getLatestDeclarationContact(id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Get declaration failed';
      const step =
        e instanceof AuthWorkflowError ? e.step : 'GET_LATEST_DECLARATION';
      this.logger.error(`session=${id} step=${step}: ${message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          error: 'Bad Gateway',
          step,
          message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** DELETE /auth/sessions/:id */
  @Delete('sessions/:id')
  logout(@Param('id') id: string) {
    const ok = this.authService.logout(id);
    if (!ok) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return { ok: true };
  }
}
