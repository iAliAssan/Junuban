import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminSettingsService } from "./admin-settings.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { UpdateSiteSettingsDto } from "./dto/update-site-settings.dto";
import { AdminSessionGuard, type AdminAuthenticatedRequest } from "../auth/guards/admin-session.guard";
import { AdminOwnerGuard } from "../auth/guards/admin-owner.guard";

/**
 * Payment/card settings specifically require OWNER, not just any admin
 * staff account — this configures where real customer payments are
 * sent, which is a materially different trust level than editing a
 * product listing or category. Same reasoning as the activity log's
 * own OWNER-only restriction.
 */
@ApiTags("admin-settings")
@UseGuards(AdminSessionGuard, AdminOwnerGuard)
@Controller({ path: "admin/settings/payment", version: "1" })
export class AdminSettingsController {
  constructor(
    private readonly settings: AdminSettingsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Get()
  getPaymentSettings() {
    return this.settings.getPaymentSettings();
  }

  @Patch()
  async updatePaymentSettings(@Body() dto: UpdateSiteSettingsDto, @Req() req: AdminAuthenticatedRequest) {
    const updated = await this.settings.updatePaymentSettings(dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "settings.update_payment",
      entityType: "SiteSettings",
      entityId: "singleton",
      metadata: {
        cardToCardConfigured: Boolean(updated.cardToCardNumber),
        shebaConfigured: Boolean(updated.shebaIban),
      },
    });
    return updated;
  }
}
