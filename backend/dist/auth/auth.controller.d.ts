import { AuthService } from './auth.service';
import { ContactsByTaxCodesDto, LoginByTaxCodeDto, LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    private readonly logger;
    constructor(authService: AuthService);
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
    login(dto: LoginDto): Promise<import("./auth.service").SessionInfo>;
    getCookies(id: string): Promise<{
        sessionId: string;
        baseUrl: string;
        cookieHeader: string;
        cookies: import("./auth.service").CookieMap;
        cookieComplete: boolean;
        cookieCount: number;
        missingCookies: (".AspNetCore.Culture" | ".AspNetCore.Identity.Application" | "__tenant" | "idsrv.session")[];
    }>;
    getLatestDeclarationContact(id: string): Promise<{
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
    logout(id: string): {
        ok: boolean;
    };
}
