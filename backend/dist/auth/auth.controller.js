"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
let AuthController = AuthController_1 = class AuthController {
    authService;
    logger = new common_1.Logger(AuthController_1.name);
    constructor(authService) {
        this.authService = authService;
    }
    async loginByTaxCode(dto) {
        if (!dto?.taxCode?.trim()) {
            throw new common_1.HttpException('taxCode là bắt buộc', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            return await this.authService.loginByTaxCode(dto);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Login failed';
            const step = e instanceof auth_service_1.AuthWorkflowError ? e.step : 'UNKNOWN';
            this.logger.error(`login-by-tax-code taxCode=${dto.taxCode} step=${step}: ${message}`);
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.BAD_GATEWAY,
                error: 'Bad Gateway',
                step,
                message,
            }, common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async contactsByTaxCodes(dto) {
        if (!Array.isArray(dto?.taxCodes) || !dto.taxCodes.length) {
            throw new common_1.HttpException('taxCodes phải là danh sách có ít nhất một MST', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            return await this.authService.contactsByTaxCodes(dto);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Batch failed';
            const step = e instanceof auth_service_1.AuthWorkflowError ? e.step : 'UNKNOWN';
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.BAD_GATEWAY,
                error: 'Bad Gateway',
                step,
                message,
            }, common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async login(dto) {
        if (!dto?.taxCode?.trim()) {
            throw new common_1.HttpException('taxCode là bắt buộc', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!dto?.username?.trim() || !dto?.password) {
            throw new common_1.HttpException('username và password là bắt buộc', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            return await this.authService.login(dto);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Login failed';
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async getCookies(id) {
        const data = await this.authService.getCookies(id);
        if (!data) {
            throw new common_1.HttpException('Session not found', common_1.HttpStatus.NOT_FOUND);
        }
        return data;
    }
    async getLatestDeclarationContact(id) {
        try {
            return await this.authService.getLatestDeclarationContact(id);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Get declaration failed';
            const step = e instanceof auth_service_1.AuthWorkflowError ? e.step : 'GET_LATEST_DECLARATION';
            this.logger.error(`session=${id} step=${step}: ${message}`);
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.BAD_GATEWAY,
                error: 'Bad Gateway',
                step,
                message,
            }, common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    logout(id) {
        const ok = this.authService.logout(id);
        if (!ok) {
            throw new common_1.HttpException('Session not found', common_1.HttpStatus.NOT_FOUND);
        }
        return { ok: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login-by-tax-code'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginByTaxCodeDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginByTaxCode", null);
__decorate([
    (0, common_1.Post)('contacts-by-tax-codes'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.ContactsByTaxCodesDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "contactsByTaxCodes", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('sessions/:id/cookies'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getCookies", null);
__decorate([
    (0, common_1.Get)('sessions/:id/latest-declaration-contact'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getLatestDeclarationContact", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map