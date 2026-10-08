import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ContactsByTaxCodesDto,
  LoginByTaxCodeDto,
  LoginDto,
} from './dto/login.dto';
import { randomUUID } from 'crypto';

const COOKIE_KEYS = [
  '.AspNetCore.Culture',
  '.AspNetCore.Identity.Application',
  '__tenant',
  'idsrv.session',
] as const;

export type CookieMap = Record<(typeof COOKIE_KEYS)[number], string | null>;

export type SessionInfo = {
  sessionId: string;
  baseUrl: string;
  cookieHeader: string;
  cookies: CookieMap;
  cookieComplete: boolean;
  cookieCount: number;
  missingCookies: string[];
  loginStatus: number;
  loginData: unknown;
  requestVerificationToken: string;
  createdAt: string;
};

type StoredSession = {
  cookieStore: Map<string, string>;
  client: AxiosInstance;
  baseUrl: string;
  createdAt: Date;
};

export class AuthWorkflowError extends Error {
  constructor(
    public readonly step: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AuthWorkflowError';
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly sessions = new Map<string, StoredSession>();
  private readonly tenantSessions = new Map<string, string>();
  private readonly invoiceVersions = new Map<string, '1.0' | '2.0'>();
  private crmTokenCache: { token: string; credentialKey: string } | null = null;

  constructor(private readonly config: ConfigService) {}

  async loginByTaxCode(dto: LoginByTaxCodeDto) {
    const taxCode = (dto.taxCode || '').trim();
    if (!taxCode) throw new Error('taxCode là bắt buộc');
    this.logger.log(`[START] login-by-tax-code taxCode=${taxCode}`);

    return this.getContactForTaxCode(taxCode, dto);
  }

  async contactsByTaxCodes(dto: ContactsByTaxCodesDto) {
    const taxCodes = [
      ...new Set(
        (Array.isArray(dto.taxCodes) ? dto.taxCodes : [])
          .map((taxCode) => String(taxCode || '').trim())
          .filter(Boolean),
      ),
    ];
    if (!taxCodes.length) {
      throw new AuthWorkflowError(
        'VALIDATION',
        'taxCodes phải là danh sách có ít nhất một mã số thuế.',
      );
    }

    const items: Array<Record<string, unknown>> = [];
    // Chạy tuần tự để không reset/login hàng loạt cùng lúc trên CRM.
    for (const taxCode of taxCodes) {
      try {
        const contact = await this.getContactForTaxCode(taxCode, dto);
        items.push({ taxCode, success: true, ...contact });
      } catch (error) {
        const step =
          error instanceof AuthWorkflowError ? error.step : 'UNKNOWN';
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[BATCH] taxCode=${taxCode} step=${step} - ${message}`,
        );
        items.push({
          taxCode,
          success: false,
          version: null,
          declarationType: null,
          email: null,
          phone: null,
          declarationDate: null,
          step,
          error: message,
        });
      }
    }

    const successCount = items.filter((item) => item.success).length;
    return {
      total: items.length,
      successCount,
      failureCount: items.length - successCount,
      items,
    };
  }

  private async getContactForTaxCode(
    taxCode: string,
    dto: {
      rememberMe?: boolean;
      baseHost?: string;
      crmUsername?: string;
      crmPassword?: string;
      crmBranchCode?: string;
    },
  ) {
    if (this.invoiceVersions.get(taxCode) === '1.0') {
      this.logger.log(
        `[VERSION_CACHE] taxCode=${taxCode} version=1.0 - gọi trực tiếp API cũ`,
      );
      return this.getOldAppContact(taxCode);
    }

    const cachedSessionId = this.tenantSessions.get(taxCode);
    if (cachedSessionId && this.sessions.has(cachedSessionId)) {
      try {
        this.logger.log(
          `[TENANT_SESSION_CACHE] taxCode=${taxCode} session=${cachedSessionId} - sử dụng lại`,
        );
        const contact =
          await this.getLatestDeclarationContact(cachedSessionId);
        return {
          version: '2.0',
          declarationType: this.formatDeclarationType(contact.decree),
          email: contact.email,
          phone: contact.phone,
          declarationDate: contact.declaration.dateCreate,
        };
      } catch (error) {
        if (!this.isExpiredSessionError(error)) throw error;
        this.logger.warn(
          `[TENANT_SESSION_CACHE] taxCode=${taxCode} - session hết hạn, đăng nhập lại`,
        );
        this.sessions.delete(cachedSessionId);
        this.tenantSessions.delete(taxCode);
      }
    } else if (cachedSessionId) {
      this.tenantSessions.delete(taxCode);
    }

    const credentials = this.getCrmCredentials(dto);
    let resetData: { account?: string; passWord?: string };
    try {
      resetData = await this.resetPasswordNewApp(taxCode, credentials);
    } catch (error) {
      if (!this.shouldFallbackToOldApp(error)) throw error;
      this.logger.warn(
        `[VERSION_FALLBACK] taxCode=${taxCode} - không có tài khoản support 2.0, chuyển sang hóa đơn 1.0`,
      );
      this.invoiceVersions.set(taxCode, '1.0');
      return this.getOldAppContact(taxCode);
    }
    const account = resetData?.account;
    const password = resetData?.passWord;
    if (!account || !password) {
      throw new AuthWorkflowError(
        'RESET_PASSWORD_NEW_APP',
        `Không lấy được tài khoản 2.0 cho MST ${taxCode}: ${this.safeDetail(resetData)}`,
      );
    }

    const session = await this.loginTenantWithRetry(
      taxCode,
      dto,
      credentials,
      account,
      password,
    );
    this.tenantSessions.set(taxCode, session.sessionId);
    this.invoiceVersions.set(taxCode, '2.0');

    const contact = await this.getLatestDeclarationContact(session.sessionId);
    return {
      version: '2.0',
      declarationType: this.formatDeclarationType(contact.decree),
      email: contact.email,
      phone: contact.phone,
      declarationDate: contact.declaration.dateCreate,
    };
  }

  private getCrmCredentials(dto: {
    crmUsername?: string;
    crmPassword?: string;
    crmBranchCode?: string;
  }) {
    const username =
      dto.crmUsername?.trim() ||
      this.config.get<string>('CRM_USERNAME') ||
      '';
    const password =
      dto.crmPassword || this.config.get<string>('CRM_PASSWORD') || '';
    const branchCode =
      dto.crmBranchCode?.trim() ||
      this.config.get<string>('CRM_BRANCH_CODE') ||
      'VP';

    if (!username || !password) {
      throw new AuthWorkflowError(
        'CRM_CONFIG',
        'Chưa cấu hình CRM_USERNAME, CRM_PASSWORD, CRM_BRANCH_CODE.',
      );
    }
    return { username, password, branchCode };
  }

  private async getCrmToken(
    credentials: {
      username: string;
      password: string;
      branchCode: string;
    },
    forceRefresh = false,
  ): Promise<string> {
    const credentialKey = `${credentials.username}|${credentials.branchCode}`;
    if (
      !forceRefresh &&
      this.crmTokenCache?.credentialKey === credentialKey
    ) {
      this.logger.log('[CRM_TOKEN_CACHE] sử dụng lại CRM token');
      return this.crmTokenCache.token;
    }

    const response = await this.runStep('CRM_LOGIN', 'CRM', () =>
      axios.post(
        'https://admin.minvoice.com.vn/api/Account/Login',
        {
          username: credentials.username,
          password: credentials.password,
          ma_dvcs: credentials.branchCode,
        },
        { timeout: 60000 },
      ),
    );
    const token = response.data?.token;
    if (!token) {
      throw new AuthWorkflowError(
        'CRM_LOGIN',
        `Không lấy được token CRM: ${this.safeDetail(response.data)}`,
      );
    }
    this.crmTokenCache = { token, credentialKey };
    this.logger.log('[CRM_TOKEN_CACHE] đã lưu CRM token mới');
    return token;
  }

  private async resetPasswordNewApp(
    taxCode: string,
    credentials: {
      username: string;
      password: string;
      branchCode: string;
    },
  ) {
    let token = await this.getCrmToken(credentials);
    let response = await this.requestResetPasswordNewApp(
      taxCode,
      token,
      credentials.branchCode,
    );

    if (this.isCrmAuthFailure(response.status, response.data)) {
      this.logger.warn(
        `[CRM_TOKEN_CACHE] taxCode=${taxCode} - CRM token hết hạn, login lại một lần`,
      );
      this.crmTokenCache = null;
      token = await this.getCrmToken(credentials, true);
      response = await this.requestResetPasswordNewApp(
        taxCode,
        token,
        credentials.branchCode,
      );
    }

    if (response.status >= 400) {
      throw new AuthWorkflowError(
        'RESET_PASSWORD_NEW_APP',
        `HTTP ${response.status}: ${this.safeDetail(response.data)}`,
        response.status,
      );
    }
    const resetData = response.data?.data;
    if (!resetData?.account || !resetData?.passWord) {
      throw new AuthWorkflowError(
        'RESET_PASSWORD_NEW_APP',
        `Không lấy được tài khoản 2.0 cho MST ${taxCode}: ${this.safeDetail(response.data)}`,
      );
    }
    return resetData;
  }

  private requestResetPasswordNewApp(
    taxCode: string,
    crmToken: string,
    branchCode: string,
  ) {
    return this.runStep('RESET_PASSWORD_NEW_APP', taxCode, () =>
      axios.post(
        'https://admin.minvoice.com.vn/api/Dmkh/ResetPasswordNewApp',
        {
          taxCode,
          customerType: 2,
          account: 'support',
          email: '',
        },
        {
          timeout: 60000,
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bear ${crmToken};${branchCode}`,
          },
        },
      ),
    );
  }

  private async loginTenantWithRetry(
    taxCode: string,
    dto: { rememberMe?: boolean; baseHost?: string },
    crmCredentials: {
      username: string;
      password: string;
      branchCode: string;
    },
    initialAccount: string,
    initialPassword: string,
  ): Promise<SessionInfo> {
    let account = initialAccount;
    let password = initialPassword;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (attempt > 1) {
        this.logger.warn(
          `[TENANT_LOGIN_RETRY] taxCode=${taxCode} attempt=${attempt}/${maxAttempts}`,
        );
        await this.delay(attempt === 2 ? 1000 : 1500);
      }

      // Lần cuối reset lại để lấy mật khẩu mới nếu 2 lần login trước chưa đồng bộ.
      if (attempt === 3) {
        const refreshed = await this.resetPasswordNewApp(
          taxCode,
          crmCredentials,
        );
        account = refreshed.account;
        password = refreshed.passWord;
      }

      try {
        return await this.runStep('TENANT_LOGIN', taxCode, () =>
          this.login({
            taxCode,
            username: account,
            password,
            rememberMe: dto.rememberMe,
            baseHost: dto.baseHost,
          }),
        );
      } catch (error) {
        const canRetry =
          error instanceof Error &&
          error.message
            .toLowerCase()
            .includes('invalidusernameorpassword');
        if (!canRetry || attempt === maxAttempts) throw error;
      }
    }

    throw new AuthWorkflowError(
      'TENANT_LOGIN',
      `Login tenant thất bại sau ${maxAttempts} lần thử.`,
    );
  }

  private shouldFallbackToOldApp(error: unknown): boolean {
    if (!(error instanceof AuthWorkflowError)) return false;
    const message = error.message.toLowerCase();
    const normalized = message
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd');
    return (
      error.step === 'RESET_PASSWORD_NEW_APP' &&
      (message.includes("account = ['support'] is not exist") ||
        normalized.includes('khong tim thay thong tin khach hang') ||
        normalized.includes('khach hang chua su dung phan mem phien ban nay'))
    );
  }

  private async getOldAppContact(taxCode: string) {
    const rawToken =
      this.config.get<string>('OLD_APP_BEAR_TOKEN')?.trim() || '';
    if (!rawToken) {
      throw new AuthWorkflowError(
        'OLD_APP_CONFIG',
        'Chưa cấu hình OLD_APP_BEAR_TOKEN trong backend/.env',
      );
    }

    const hostTaxCode = taxCode.replace(/-/g, '');
    const authorization = rawToken.startsWith('Bear ')
      ? rawToken
      : `Bear ${rawToken}`;

    let response = await this.runStep('GET_OLD_APP_DECLARATION_ND70', taxCode, () =>
      axios.post(
        `https://${hostTaxCode}.minvoice.com.vn/api/Pattern/GetData`,
        {
          command: 'CM0006_70',
          start: 0,
          count: 50,
          filter: [],
          tlbparam: [],
        },
        {
          timeout: 60000,
          validateStatus: () => true,
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
            Authorization: authorization,
            Origin: `https://${hostTaxCode}.minvoice.com.vn`,
            Referer: `https://${hostTaxCode}.minvoice.com.vn/`,
          },
        },
      ),
    );

    if (response.status >= 400) {
      throw new AuthWorkflowError(
        'GET_OLD_APP_DECLARATION_ND70',
        `Upstream HTTP ${response.status}: ${this.safeDetail(response.data)}`,
        response.status,
      );
    }

    let data = response.data as {
      data?: Array<Record<string, unknown>>;
      total_count?: number;
      error?: string;
    };
    if (data?.error) {
      throw new AuthWorkflowError(
        'GET_OLD_APP_DECLARATION_ND70',
        `API hóa đơn 1.0 lỗi: ${data.error}`,
      );
    }
    let decree: 'ND70' | 'ND123' = 'ND70';
    let declarations = Array.isArray(data?.data) ? [...data.data] : [];

    if (!declarations.length) {
      this.logger.warn(
        `[GET_OLD_APP_DECLARATION] taxCode=${taxCode} - ND70 không có tờ khai, chuyển ND123`,
      );
      response = await this.runStep(
        'GET_OLD_APP_DECLARATION_ND123',
        taxCode,
        () =>
          axios.get(
            `https://${hostTaxCode}.minvoice.com.vn/api/Pattern/GetData`,
            {
              params: {
                command: 'CM0006',
                start: 0,
                count: 50,
                continue: 'null',
                filter: 'null',
              },
              timeout: 60000,
              validateStatus: () => true,
              headers: {
                Accept: '*/*',
                Authorization: authorization,
                Origin: `https://${hostTaxCode}.minvoice.com.vn`,
                Referer: `https://${hostTaxCode}.minvoice.com.vn/`,
              },
            },
          ),
      );
      if (response.status >= 400) {
        throw new AuthWorkflowError(
          'GET_OLD_APP_DECLARATION_ND123',
          `Upstream HTTP ${response.status}: ${this.safeDetail(response.data)}`,
          response.status,
        );
      }
      data = response.data as {
        data?: Array<Record<string, unknown>>;
        total_count?: number;
        error?: string;
      };
      if (data?.error) {
        throw new AuthWorkflowError(
          'GET_OLD_APP_DECLARATION_ND123',
          `API hóa đơn 1.0 lỗi: ${data.error}`,
        );
      }
      decree = 'ND123';
      declarations = Array.isArray(data?.data) ? [...data.data] : [];
    }

    declarations.sort(
      (a, b) =>
        this.oldDeclarationTime(b) - this.oldDeclarationTime(a),
    );
    const latest = declarations[0];
    if (!latest) {
      throw new AuthWorkflowError(
        'GET_OLD_APP_DECLARATION',
        `Không tìm thấy tờ khai ND70 hoặc ND123 của hóa đơn 1.0 cho MST ${taxCode}.`,
      );
    }

    const email = latest.dctdtu ?? null;
    const phone = latest.dtlhe ?? null;
    const declarationDate = latest.nlap ?? latest.ngay_gui ?? null;
    this.logger.log(
      `[GET_OLD_APP_DECLARATION] thành công taxCode=${taxCode} decree=${decree} total=${data.total_count ?? declarations.length} latestId=${String(latest.id ?? '')} email=${String(email ?? '')} phone=${String(phone ?? '')}`,
    );
    return {
      version: '1.0',
      declarationType: this.formatDeclarationType(decree),
      email,
      phone,
      declarationDate,
    };
  }

  async login(dto: LoginDto): Promise<SessionInfo> {
    const taxCode = (dto.taxCode || '').trim();
    if (!taxCode) throw new Error('taxCode là bắt buộc');
    if (!dto.username?.trim()) throw new Error('username là bắt buộc');
    if (!dto.password) throw new Error('password là bắt buộc');

    const baseUrl = this.resolveBaseUrl(taxCode, dto.baseHost);
    const cookieStore = new Map<string, string>([
      ['.AspNetCore.Culture', 'c%3Den%7Cuic%3Den'],
    ]);

    const client = axios.create({
      baseURL: baseUrl,
      timeout: 60000,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'vi',
        'X-Culture': 'vi',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
        Referer: `${baseUrl}/`,
        Origin: baseUrl,
      },
    });

    // Tenant phải resolve bằng header __tenant (MST hoặc MST-CN), không thì login ra InvalidUserNameOrPassword
    const tenantHeaders = {
      __tenant: taxCode,
      'Abp.TenantId': taxCode,
    };

    // 1) Seed __tenant cookie + XSRF
    const seedRes = await client.get('/api/api/abp/application-configuration', {
      headers: {
        Accept: 'application/json',
        Cookie: this.toCookieHeader(cookieStore),
        ...tenantHeaders,
      },
    });
    this.absorbSetCookies(cookieStore, seedRes);

    const xsrf =
      dto.requestVerificationToken?.trim() ||
      cookieStore.get('XSRF-TOKEN') ||
      '';

    if (!xsrf) {
      throw new Error(
        'Không lấy được XSRF-TOKEN từ /api/api/abp/application-configuration',
      );
    }

    // 2) Login
    const loginRes = await client.post(
      '/api/api/account/login',
      {
        userNameOrEmailAddress: dto.username.trim(),
        password: dto.password,
        rememberMe: Boolean(dto.rememberMe),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          RequestVerificationToken: xsrf,
          Cookie: this.toCookieHeader(cookieStore),
          ...tenantHeaders,
        },
      },
    );
    this.absorbSetCookies(cookieStore, loginRes);

    const loginData = loginRes.data as { result?: number; description?: string };
    if (loginRes.status >= 400) {
      throw new Error(
        `Login thất bại HTTP ${loginRes.status}: ${this.safeDetail(loginRes.data)}`,
      );
    }
    if (loginData?.result !== undefined && loginData.result !== 1) {
      throw new Error(
        `Login thất bại: ${loginData.description || `result=${loginData.result}`}`,
      );
    }

    const cookies = this.pickCookies(cookieStore);
    const missingCookies = COOKIE_KEYS.filter((key) => !cookies[key]);
    const cookieCount = COOKIE_KEYS.length - missingCookies.length;
    if (!cookies['.AspNetCore.Identity.Application']) {
      throw new Error(
        'Login không trả cookie .AspNetCore.Identity.Application',
      );
    }

    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      cookieStore,
      client,
      baseUrl,
      createdAt: new Date(),
    });

    this.logger.log(
      `Login OK session=${sessionId} tax=${taxCode} status=${loginRes.status}`,
    );
    this.logger.log(
      `Cookies ${cookieCount}/${COOKIE_KEYS.length} session=${sessionId}${missingCookies.length ? ` missing=${missingCookies.join(',')}` : ' - đầy đủ'}`,
    );

    return {
      sessionId,
      baseUrl,
      cookieHeader: this.toCookieHeader(cookieStore, COOKIE_KEYS as unknown as string[]),
      cookies,
      cookieComplete: missingCookies.length === 0,
      cookieCount,
      missingCookies,
      loginStatus: loginRes.status,
      loginData: loginRes.data ?? null,
      requestVerificationToken: xsrf,
      createdAt: new Date().toISOString(),
    };
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  async getCookies(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const cookies = this.pickCookies(session.cookieStore);
    const missingCookies = COOKIE_KEYS.filter((key) => !cookies[key]);
    return {
      sessionId,
      baseUrl: session.baseUrl,
      cookieHeader: this.toCookieHeader(
        session.cookieStore,
        COOKIE_KEYS as unknown as string[],
      ),
      cookies,
      cookieComplete: missingCookies.length === 0,
      cookieCount: COOKIE_KEYS.length - missingCookies.length,
      missingCookies,
    };
  }

  async getLatestDeclarationContact(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AuthWorkflowError(
        'SESSION',
        'Session không tồn tại hoặc backend đã restart. Hãy đăng nhập lại.',
      );
    }

    const xsrf = session.cookieStore.get('XSRF-TOKEN') || '';
    const requestHeaders = {
      RequestVerificationToken: xsrf,
      Cookie: this.toCookieHeader(session.cookieStore),
      Referer: `${session.baseUrl}/`,
      'X-Culture': 'vi',
    };

    let response = await this.runStep(
      'GET_LATEST_DECLARATION_ND70',
      session.baseUrl,
      () =>
        session.client.get('/api/api/app/declare-register-invoice', {
          params: {
            maxResultCount: 50,
            skipCount: 0,
          },
          headers: requestHeaders,
        }),
    );

    if (response.status >= 400) {
      throw new AuthWorkflowError(
        'GET_LATEST_DECLARATION_ND70',
        `Upstream HTTP ${response.status}: ${this.safeDetail(response.data)}`,
        response.status,
      );
    }

    let data = response.data as {
      totalCount?: number;
      items?: Array<Record<string, unknown>>;
    };
    let decree: 'ND70' | 'ND123' = 'ND70';
    let items = Array.isArray(data?.items) ? [...data.items] : [];

    if (!items.length) {
      this.logger.warn(
        `[GET_LATEST_DECLARATION] session=${sessionId} - ND70 không có tờ khai, chuyển ND123`,
      );
      response = await this.runStep(
        'GET_LATEST_DECLARATION_ND123',
        session.baseUrl,
        () =>
          session.client.get('/api/api/app/declare-register-invoice-old', {
            params: {
              maxResultCount: 50,
              skipCount: 0,
            },
            headers: requestHeaders,
          }),
      );
      if (response.status >= 400) {
        throw new AuthWorkflowError(
          'GET_LATEST_DECLARATION_ND123',
          `Upstream HTTP ${response.status}: ${this.safeDetail(response.data)}`,
          response.status,
        );
      }
      data = response.data as {
        totalCount?: number;
        items?: Array<Record<string, unknown>>;
      };
      decree = 'ND123';
      items = Array.isArray(data?.items) ? [...data.items] : [];
    }

    items.sort(
      (a, b) =>
        this.declarationTime(b) - this.declarationTime(a),
    );

    const latest = items[0] ?? null;
    if (!latest) {
      throw new AuthWorkflowError(
        'GET_LATEST_DECLARATION',
        'Không tìm thấy tờ khai ND70 hoặc ND123.',
      );
    }

    this.logger.log(
      `[GET_LATEST_DECLARATION] thành công session=${sessionId} decree=${decree} total=${data.totalCount ?? items.length} latestId=${String(latest.id ?? '')} email=${String(latest.email ?? '')} phone=${String(latest.phone ?? '')}`,
    );

    return {
      sessionId,
      decree,
      totalCount: data.totalCount ?? items.length,
      email: latest.email ?? null,
      phone: latest.phone ?? null,
      declaration: {
        id: latest.id ?? null,
        taxCode: latest.taxCode ?? null,
        taxpayers: latest.taxpayers ?? null,
        dateCreate: latest.dateCreate ?? null,
        creationTime: latest.creationTime ?? null,
      },
    };
  }

  logout(sessionId: string): boolean {
    for (const [taxCode, cachedSessionId] of this.tenantSessions) {
      if (cachedSessionId === sessionId) {
        this.tenantSessions.delete(taxCode);
      }
    }
    return this.sessions.delete(sessionId);
  }

  private resolveBaseUrl(taxCode: string, baseHost?: string): string {
    const host = (baseHost || '')
      .toString()
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
    if (host) return `https://${host}`;
    const fromEnv = this.config.get<string>('TARGET_BASE_URL')?.trim();
    if (fromEnv && !taxCode) return fromEnv.replace(/\/+$/, '');
    return `https://${taxCode}.minvoice.net`;
  }

  private absorbSetCookies(
    store: Map<string, string>,
    res: AxiosResponse,
  ) {
    const raw = res.headers['set-cookie'];
    if (!raw) return;
    const list = Array.isArray(raw) ? raw : [raw];
    for (const line of list) {
      const pair = String(line).split(';', 1)[0];
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) store.set(name, value);
    }
  }

  private toCookieHeader(
    store: Map<string, string>,
    onlyKeys?: string[],
  ): string {
    const entries = onlyKeys
      ? onlyKeys
          .filter((k) => store.has(k))
          .map((k) => [k, store.get(k)!] as const)
      : [...store.entries()];
    return entries.map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private pickCookies(store: Map<string, string>): CookieMap {
    return Object.fromEntries(
      COOKIE_KEYS.map((k) => [k, store.get(k) ?? null]),
    ) as CookieMap;
  }

  private safeDetail(data: unknown): string {
    if (typeof data === 'string') return data.slice(0, 300);
    try {
      return JSON.stringify(data).slice(0, 300);
    } catch {
      return '';
    }
  }

  private declarationTime(item: Record<string, unknown>): number {
    const raw =
      item.creationTime ?? item.dateCreate ?? item.lastModificationTime ?? '';
    const time = Date.parse(String(raw));
    return Number.isNaN(time) ? 0 : time;
  }

  private oldDeclarationTime(item: Record<string, unknown>): number {
    const raw = item.ngay_gui ?? item.nlap ?? '';
    const time = Date.parse(String(raw));
    return Number.isNaN(time) ? 0 : time;
  }

  private formatDeclarationType(decree: 'ND70' | 'ND123'): 'NĐ70' | 'NĐ123' {
    return decree === 'ND70' ? 'NĐ70' : 'NĐ123';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isExpiredSessionError(error: unknown): boolean {
    return (
      error instanceof AuthWorkflowError &&
      [401, 403].includes(error.status ?? 0)
    );
  }

  private isCrmAuthFailure(status: number, data: unknown): boolean {
    if ([401, 403].includes(status)) return true;
    const text = this.safeDetail(data).toLowerCase();
    return (
      text.includes('unauthorized') ||
      text.includes('token expired') ||
      text.includes('token hết hạn')
    );
  }

  private async runStep<T>(
    step: string,
    taxCode: string,
    action: () => Promise<T>,
  ): Promise<T> {
    this.logger.log(`[${step}] taxCode=${taxCode} - bắt đầu`);
    try {
      const result = await action();
      this.logger.log(`[${step}] taxCode=${taxCode} - thành công`);
      return result;
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? `HTTP ${error.response?.status ?? 'N/A'}: ${this.safeDetail(error.response?.data ?? error.message)}`
        : error instanceof Error
          ? error.message
          : String(error);
      this.logger.error(`[${step}] taxCode=${taxCode} - ${message}`);
      if (error instanceof AuthWorkflowError) throw error;
      throw new AuthWorkflowError(
        step,
        message,
        axios.isAxiosError(error) ? error.response?.status : undefined,
      );
    }
  }
}
