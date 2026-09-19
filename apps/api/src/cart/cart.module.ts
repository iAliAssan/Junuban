import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { CartContextService } from "./cart-context.service";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [CartController],
  providers: [CartService, CartContextService],
  exports: [CartService, CartContextService],
})
export class CartModule {}
