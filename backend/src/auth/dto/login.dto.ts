export class LoginDto {
  /** MST hoặc MST-chi nhánh, vd: 0106026495-998 */
  taxCode!: string;
  /** userNameOrEmailAddress */
  username!: string;
  password!: string;
  rememberMe?: boolean;
  /**
   * Optional — nếu không truyền, backend tự lấy từ cookie XSRF-TOKEN
   * sau khi GET trang / application-configuration.
   */
  requestVerificationToken?: string;
  /** Override host, vd: hddt.minvoice.com.vn — mặc định {taxCode}.minvoice.net */
  baseHost?: string;
}

export class LoginByTaxCodeDto {
  /** MST hoặc MST-chi nhánh, vd: 0106026495-998 */
  taxCode!: string;
  rememberMe?: boolean;
  baseHost?: string;
  /** Có thể truyền khi test; production nên cấu hình trong .env */
  crmUsername?: string;
  crmPassword?: string;
  crmBranchCode?: string;
}

export class ContactsByTaxCodesDto {
  /** Danh sách MST/MST-chi nhánh */
  taxCodes!: string[];
  rememberMe?: boolean;
  crmUsername?: string;
  crmPassword?: string;
  crmBranchCode?: string;
}
