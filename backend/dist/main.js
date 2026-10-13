"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn'],
    });
    const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    app.enableCors({
        origin,
        credentials: true,
    });
    const port = Number(process.env.PORT ?? 3001);
    await app.listen(port, '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map