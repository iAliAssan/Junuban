import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * PENDING_PAYMENT and PAID are deliberately excluded — PENDING_PAYMENT
 * is never a valid transition *target* (see order-status.util.ts), and
 * PAID already has its own dedicated, more specific route
 * (`POST /admin/orders/:id/mark-paid`) that also confirms the matching
 * payment attempt, which a generic status-set must not skip.
 */
const ADMIN_SETTABLE_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export class SetOrderStatusDto {
  @ApiProperty({ enum: ADMIN_SETTABLE_STATUSES })
  @IsIn(ADMIN_SETTABLE_STATUSES, { message: "وضعیت انتخاب‌شده معتبر نیست" })
  status!: (typeof ADMIN_SETTABLE_STATUSES)[number];

  @ApiPropertyOptional({ description: "Optional internal note recorded in the order's status history." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
