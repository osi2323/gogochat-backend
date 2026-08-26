import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  AccessLevel,
  LoginDesignType,
  SiteLanguage,
} from '../entities/system-settings.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ readOnly: true, description: 'Ignored if sent' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  everyoneCanEnter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  desktopLoginEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mobileLoginEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestLoginEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newRegistrationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestCanWrite?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  staffCanChangeNickname?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  friendsPrivateMessageMembersOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  membersPrivateMessageEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  membersVoiceCallEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestPrivateMessageEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestVoiceCallEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  firstMessageDelayEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Aktifse saniye cinsinden' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ValidateIf(
    (o) =>
      o.firstMessageDelayEnabled === true ||
      o.firstMessageDelaySeconds !== undefined,
  )
  firstMessageDelaySeconds?: number;

  @ApiPropertyOptional({ description: 'Misafir bekleme süresi (saniye)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  guestWaitSeconds?: number;

  @ApiPropertyOptional({ description: 'Üye/Misafir mikrofon süresi (saniye)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  memberAndGuestMicDurationSeconds?: number;

  @ApiPropertyOptional({ enum: SiteLanguage })
  @IsOptional()
  @IsEnum(SiteLanguage)
  siteLanguage?: SiteLanguage;

  @ApiPropertyOptional({ enum: AccessLevel })
  @IsOptional()
  @IsEnum(AccessLevel)
  chatImageSendPermission?: AccessLevel;

  @ApiPropertyOptional({ enum: AccessLevel })
  @IsOptional()
  @IsEnum(AccessLevel)
  chatVoiceSendPermission?: AccessLevel;

  @ApiPropertyOptional({ enum: AccessLevel })
  @IsOptional()
  @IsEnum(AccessLevel)
  chatVoiceRecordSendPermission?: AccessLevel;

  @ApiPropertyOptional({ enum: AccessLevel })
  @IsOptional()
  @IsEnum(AccessLevel)
  chatYoutubeSendPermission?: AccessLevel;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  siteName?: string;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Tarayıcı sekme başlığı',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  siteTitle?: string;

  @ApiPropertyOptional({ description: 'Site açıklaması' })
  @IsOptional()
  @IsString()
  siteDescription?: string;

  @ApiPropertyOptional({ description: 'Ana sayfa HTML içeriği' })
  @IsOptional()
  @IsString()
  homePageHtml?: string;

  @ApiPropertyOptional({ description: 'Karşılama mesajı şablonu' })
  @IsOptional()
  @IsString()
  welcomeMessageTemplate?: string;

  @ApiPropertyOptional({ enum: LoginDesignType })
  @IsOptional()
  @IsEnum(LoginDesignType)
  activeLoginDesign?: LoginDesignType;

  @ApiPropertyOptional({ description: 'Maksimum kullanıcı sayısı' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUserCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({ description: 'Mobil cihazlarda mikrofonları göster' })
  @IsOptional()
  @IsBoolean()
  showMicrophonesOnMobile?: boolean;

  @ApiPropertyOptional({
    description: 'Ana sayfa arka plan resmi (URL veya Data URL)',
  })
  @IsOptional()
  @IsString()
  homePageImage?: string;

  @ApiPropertyOptional({ description: 'Ana sayfa logosu (URL veya Data URL)' })
  @IsOptional()
  @IsString()
  homePageLogo?: string;

  @ApiPropertyOptional({ description: 'Sohbet üst alan logosu (URL veya Data URL)' })
  @IsOptional()
  @IsString()
  chatHeaderLogo?: string;

  @ApiPropertyOptional({ type: [String], description: 'Sıralı site sahibi kullanıcı adları' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteOwnerUsernames?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Sıralı yönetici kullanıcı adları' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  managerUsernames?: string[];

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  premiumArticleTopTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  premiumArticleTopContent?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  premiumArticleMiddleTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  premiumArticleMiddleContent?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  premiumArticleBottomTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  premiumArticleBottomContent?: string;

  @ApiPropertyOptional({ description: 'Premium Android uygulama linki' })
  @IsOptional()
  @IsString()
  premiumAndroidAppUrl?: string;

  @ApiPropertyOptional({ description: 'Premium IOS uygulama linki' })
  @IsOptional()
  @IsString()
  premiumIosAppUrl?: string;
}
