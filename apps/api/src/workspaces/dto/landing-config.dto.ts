import { IsArray, IsBoolean, IsHexColor, IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LandingTweaksDto {
  @IsOptional() @IsIn(['illustration', 'product', 'minimal']) hero?: string;
  @IsOptional() @IsIn(['cards', 'hero']) testimonials?: string;
  @IsOptional() @IsIn(['cards', 'table']) pricing?: string;
  @IsOptional() @IsString() accent?: string;
  @IsOptional() @IsIn(['white', 'warm']) background?: string;
}

class LandingNavDto {
  @IsOptional() @IsString() cta?: string;
}

class LandingHeroSectionDto {
  @IsOptional() @IsString() chip?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() titleHighlight?: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() cta1Label?: string;
  @IsOptional() @IsString() cta2Label?: string;
}

class LandingTestimonialDto {
  @IsOptional() @IsString() quote?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() avatarInitials?: string;
  @IsOptional() @IsString() avatarColor1?: string;
  @IsOptional() @IsString() avatarColor2?: string;
  @IsOptional() @IsString() avatarImageUrl?: string;
}

class LandingPricingPlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() cta?: string;
  @IsOptional() @IsBoolean() highlight?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
}

class LandingFaqItemDto {
  @IsOptional() @IsString() question?: string;
  @IsOptional() @IsString() answer?: string;
}

class LandingBenefitDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
}

class LandingHowItWorksItemDto {
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
}

class LandingSocialProofStatDto {
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() label?: string;
}

class LandingSocialProofDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LandingSocialProofStatDto) stats?: LandingSocialProofStatDto[];
}

class LandingSectionsDto {
  @IsOptional() @ValidateNested() @Type(() => LandingHeroSectionDto) hero?: LandingHeroSectionDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LandingHowItWorksItemDto) howItWorks?: LandingHowItWorksItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LandingBenefitDto) benefits?: LandingBenefitDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LandingTestimonialDto) testimonials?: LandingTestimonialDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LandingPricingPlanDto) pricing?: LandingPricingPlanDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LandingFaqItemDto) faq?: LandingFaqItemDto[];
  @IsOptional() @ValidateNested() @Type(() => LandingSocialProofDto) socialProof?: LandingSocialProofDto;
}

class LandingMediaDto {
  @IsOptional() @IsString() heroImageUrl?: string;
  @IsOptional() @IsString() logoUrl?: string;
}

export class UpdateLandingConfigDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @ValidateNested() @Type(() => LandingTweaksDto) tweaks?: LandingTweaksDto;
  @IsOptional() @ValidateNested() @Type(() => LandingNavDto) nav?: LandingNavDto;
  @IsOptional() @ValidateNested() @Type(() => LandingSectionsDto) sections?: LandingSectionsDto;
  @IsOptional() @ValidateNested() @Type(() => LandingMediaDto) media?: LandingMediaDto;
}
