export declare class LoginDto {
    taxCode: string;
    username: string;
    password: string;
    rememberMe?: boolean;
    requestVerificationToken?: string;
    baseHost?: string;
}
export declare class LoginByTaxCodeDto {
    taxCode: string;
    rememberMe?: boolean;
    baseHost?: string;
    crmUsername?: string;
    crmPassword?: string;
    crmBranchCode?: string;
}
export declare class ContactsByTaxCodesDto {
    taxCodes: string[];
    rememberMe?: boolean;
    crmUsername?: string;
    crmPassword?: string;
    crmBranchCode?: string;
}
