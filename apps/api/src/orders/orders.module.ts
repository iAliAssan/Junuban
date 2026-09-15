import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CartModule } from "../cart/cart.module";
import { AddressesModule } from "../addresses/addresses.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentProviderFactory } from "./payment/payment-provider.factory";

@Module({
  imports: [AuthModule, CartModule, AddressesModule],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentProviderFactory],
  exports: [OrdersService],
})
export class OrdersModule {}
