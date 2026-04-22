import {
  BillingInterval,
  BillingProvider,
  WorkspacePlan,
  WorkspaceSubscriptionStatus,
} from '../../common/types/enums';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateWorkspaceBillingDto {
  @IsOptional()
  @IsEnum(WorkspacePlan)
  plan?: WorkspacePlan;

  @IsOptional()
  @IsEnum(WorkspaceSubscriptionStatus)
  status?: WorkspaceSubscriptionStatus;

  @IsOptional()
  @IsEnum(BillingProvider)
  provider?: BillingProvider;

  @IsOptional()
  @IsEnum(BillingInterval)
  billing_interval?: BillingInterval;

  @IsOptional()
  @IsString()
  provider_customer_id?: string;

  @IsOptional()
  @IsString()
  provider_subscription_id?: string;

  @IsOptional()
  @IsString()
  external_reference?: string;

  @IsOptional()
  @IsDateString()
  current_period_start?: string;

  @IsOptional()
  @IsDateString()
  current_period_end?: string;

  @IsOptional()
  @IsDateString()
  trial_ends_at?: string;

  @IsOptional()
  @IsBoolean()
  cancel_at_period_end?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  event_type?: string;

  @IsOptional()
  metadata_json?: Record<string, any>;

  @IsOptional()
  payload_json?: Record<string, any>;
}
