import { Module, forwardRef } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { OtpService } from "./otp/otp.service";
import { SessionService } from "./session/session.service";
import { CustomerSessionGuard } from "./guards/customer-session.guard";
import { CartModule } from "../cart/cart.module";

@Module({
  imports: [forwardRef(() => CartModule)],
  controllers: [AuthController],
  providers: [OtpService, SessionService, CustomerSessionGuard],
  exports: [SessionService, CustomerSessionGuard],
})
export class AuthModule {}
