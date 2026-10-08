"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsByTaxCodesDto = exports.LoginByTaxCodeDto = exports.LoginDto = void 0;
class LoginDto {
    taxCode;
    username;
    password;
    rememberMe;
    requestVerificationToken;
    baseHost;
}
exports.LoginDto = LoginDto;
class LoginByTaxCodeDto {
    taxCode;
    rememberMe;
    baseHost;
    crmUsername;
    crmPassword;
    crmBranchCode;
}
exports.LoginByTaxCodeDto = LoginByTaxCodeDto;
class ContactsByTaxCodesDto {
    taxCodes;
    rememberMe;
    crmUsername;
    crmPassword;
    crmBranchCode;
}
exports.ContactsByTaxCodesDto = ContactsByTaxCodesDto;
//# sourceMappingURL=login.dto.js.map