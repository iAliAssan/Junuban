import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CartModule } from "../cart/cart.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentProviderFactory } from "./payment/payment-provider.factory";

@Module({
  imports: [AuthModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentProviderFactory],
  exports: [OrdersService],
})
export class OrdersModule {}
