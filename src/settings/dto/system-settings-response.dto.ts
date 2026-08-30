import { ApiProperty } from '@nestjs/swagger';
import {
  AccessLevel,
  LoginDesignType,
  SiteLanguage,
} from '../entities/system-settings.entity';

export class SystemSettingsResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty()
  everyoneCanEnter: boolean;

  @ApiProperty()
  desktopLoginEnabled: boolean;

  @ApiProperty()
  mobileLoginEnabled: boolean;

  @ApiProperty()
  guestLoginEnabled: boolean;

  @ApiProperty()
  newRegistrationEnabled: boolean;

  @ApiProperty()
  guestCanWrite: boolean;

  @ApiProperty()
  staffCanChangeNickname: boolean;

  @ApiProperty()
  friendsPrivateMessageMembersOnly: boolean;

  @ApiProperty()
  membersPrivateMessageEnabled: boolean;

  @ApiProperty()
  membersVoiceCallEnabled: boolean;

  @ApiProperty()
  guestPrivateMessageEnabled: boolean;

  @ApiProperty()
  guestVoiceCallEnabled: boolean;

  @ApiProperty()
  firstMessageDelayEnabled: boolean;

  @ApiProperty({ example: 0 })
  firstMessageDelaySeconds: number;

  @ApiProperty({ example: '2026-05-08T18:30:00.000Z', nullable: true })
  firstMessageDelayUpdatedAt?: string | null;

  @ApiProperty({ example: 10 })
  guestWaitSeconds: number;

  @ApiProperty({ example: '2026-05-08T18:30:00.000Z', nullable: true })
  guestWaitUpdatedAt?: string | null;

  @ApiProperty({ example: 120 })
  memberAndGuestMicDurationSeconds: number;

  @ApiProperty({ enum: SiteLanguage, example: SiteLanguage.TR })
  siteLanguage: SiteLanguage;

  @ApiProperty({ enum: AccessLevel })
  chatImageSendPermission: AccessLevel;

  @ApiProperty({ enum: AccessLevel })
  chatVoiceSendPermission: AccessLevel;

  @ApiProperty({ enum: AccessLevel })
  chatVoiceRecordSendPermission: AccessLevel;

  @ApiProperty({ enum: AccessLevel })
  chatYoutubeSendPermission: AccessLevel;

  @ApiProperty({ example: 'Site adı', nullable: true })
  siteName?: string | null;

  @ApiProperty({ example: 'KingMobile Sohbet', nullable: true })
  siteTitle?: string | null;

  @ApiProperty({ example: 'Site açıklaması', nullable: true })
  siteDescription?: string | null;

  @ApiProperty({ example: '<p>Hos geldiniz</p>', nullable: true })
  homePageHtml?: string | null;

  @ApiProperty({ example: 'Merhaba [username]', nullable: true })
  welcomeMessageTemplate?: string | null;

  @ApiProperty({
    enum: LoginDesignType,
    example: LoginDesignType.STANDARD,
  })
  activeLoginDesign: LoginDesignType;

  @ApiProperty({ example: 500 })
  maxUserCount: number;

  @ApiProperty()
  maintenanceMode: boolean;

  @ApiProperty({ description: 'Mobil cihazlarda mikrofonları göster' })
  showMicrophonesOnMobile: boolean;

  @ApiProperty({ description: 'Mobil sohbet üst şerit rengi', example: '#0057B8' })
  mobileHeaderColor: string;

  @ApiProperty({ description: 'Mobil sohbet alt şerit rengi', example: '#0057B8' })
  mobileFooterColor: string;

  @ApiProperty({ description: 'Site sohbet teması', example: 'glass' })
  chatSiteTheme: string;

  @ApiProperty({ description: 'Ana sayfa arka plan resmi', nullable: true })
  homePageImage?: string | null;

  @ApiProperty({ description: 'Ana sayfa logosu', nullable: true })
  homePageLogo?: string | null;

  @ApiProperty({ description: 'Sohbet üst alan logosu', nullable: true })
  chatHeaderLogo?: string | null;

  @ApiProperty({ type: [String], description: 'Sıralı site sahibi kullanıcı adları' })
  siteOwnerUsernames: string[];

  @ApiProperty({ type: [String], description: 'Sıralı yönetici kullanıcı adları' })
  managerUsernames: string[];

  @ApiProperty({ nullable: true })
  premiumArticleTopTitle?: string | null;

  @ApiProperty({ nullable: true })
  premiumArticleTopContent?: string | null;

  @ApiProperty({ nullable: true })
  premiumArticleMiddleTitle?: string | null;

  @ApiProperty({ nullable: true })
  premiumArticleMiddleContent?: string | null;

  @ApiProperty({ nullable: true })
  premiumArticleBottomTitle?: string | null;

  @ApiProperty({ nullable: true })
  premiumArticleBottomContent?: string | null;

  @ApiProperty({ nullable: true })
  premiumAndroidAppUrl?: string | null;

  @ApiProperty({ nullable: true })
  premiumIosAppUrl?: string | null;
}
