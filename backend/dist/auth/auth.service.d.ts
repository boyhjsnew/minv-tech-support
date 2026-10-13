import { ConfigService } from '@nestjs/config';
import { AxiosInstance } from 'axios';
import { ContactsByTaxCodesDto, LoginByTaxCodeDto, LoginDto } from './dto/login.dto';
declare const COOKIE_KEYS: readonly [".AspNetCore.Culture", ".AspNetCore.Identity.Application", "__tenant", "idsrv.session"];
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
export declare class AuthWorkflowError extends Error {
    readonly step: string;
    readonly status?: number | undefined;
    constructor(step: string, message: string, status?: number | undefined);
}
export declare class AuthService {
    private readonly config;
    private readonly logger;
    private readonly sessions;
    private readonly tenantSessions;
    private readonly invoiceVersions;
    private crmTokenCache;
    constructor(config: ConfigService);
    loginByTaxCode(dto: LoginByTaxCodeDto): Promise<{
        version: string;
        declarationType: "NĐ70" | "NĐ123";
        email: {} | null;
        phone: {} | null;
        declarationDate: {} | null;
    }>;
    contactsByTaxCodes(dto: ContactsByTaxCodesDto): Promise<{
        total: number;
        successCount: number;
        failureCount: number;
        items: Record<string, unknown>[];
    }>;
    private getContactForTaxCode;
    private getCrmCredentials;
    private getCrmToken;
    private resetPasswordNewApp;
    private requestResetPasswordNewApp;
    private loginTenantWithRetry;
    private shouldFallbackToOldApp;
    private getOldAppContact;
    login(dto: LoginDto): Promise<SessionInfo>;
    getSession(sessionId: string): StoredSession | null;
    getCookies(sessionId: string): Promise<{
        sessionId: string;
        baseUrl: string;
        cookieHeader: string;
        cookies: CookieMap;
        cookieComplete: boolean;
        cookieCount: number;
        missingCookies: (".AspNetCore.Culture" | ".AspNetCore.Identity.Application" | "__tenant" | "idsrv.session")[];
    } | null>;
    getLatestDeclarationContact(sessionId: string): Promise<{
        sessionId: string;
        decree: "ND70" | "ND123";
        totalCount: number;
        email: {} | null;
        phone: {} | null;
        declaration: {
            id: {} | null;
            taxCode: {} | null;
            taxpayers: {} | null;
            dateCreate: {} | null;
            creationTime: {} | null;
        };
    }>;
    logout(sessionId: string): boolean;
    private resolveBaseUrl;
    private absorbSetCookies;
    private toCookieHeader;
    private pickCookies;
    private safeDetail;
    private declarationTime;
    private oldDeclarationTime;
    private formatDeclarationType;
    private delay;
    private isExpiredSessionError;
    private isCrmAuthFailure;
    private isOldAppNotInUseResponse;
    private runStep;
}
export {};
