import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AddressesService } from "./addresses.service";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";
import { CustomerSessionGuard, type AuthenticatedRequest } from "../auth/guards/customer-session.guard";

@ApiTags("addresses")
@UseGuards(CustomerSessionGuard)
@Controller({ path: "addresses", version: "1" })
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.addresses.listForCustomer(req.customerId as string);
  }

  @Post()
  create(@Body() dto: CreateAddressDto, @Req() req: AuthenticatedRequest) {
    return this.addresses.create(req.customerId as string, dto);
  }

  @Patch(":addressId")
  update(@Param("addressId") addressId: string, @Body() dto: UpdateAddressDto, @Req() req: AuthenticatedRequest) {
    return this.addresses.update(req.customerId as string, addressId, dto);
  }

  @Delete(":addressId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("addressId") addressId: string, @Req() req: AuthenticatedRequest) {
    await this.addresses.remove(req.customerId as string, addressId);
  }
}
