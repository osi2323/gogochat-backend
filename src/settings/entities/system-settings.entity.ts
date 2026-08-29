import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AccessLevel {
  EVERYONE = 'EVERYONE',
  MEMBERS = 'MEMBERS',
  NONE = 'NONE',
}

export enum SiteLanguage {
  TR = 'tr',
  EN = 'en',
  AR = 'ar',
}

export enum LoginDesignType {
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

@Entity()
export class SystemSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  everyoneCanEnter: boolean;

  @Column({ default: false })
  desktopLoginEnabled: boolean;

  @Column({ default: false })
  mobileLoginEnabled: boolean;

  @Column({ default: false })
  guestLoginEnabled: boolean;

  @Column({ default: false })
  newRegistrationEnabled: boolean;

  @Column({ default: false })
  guestCanWrite: boolean;

  @Column({ default: false })
  staffCanChangeNickname: boolean;

  @Column({ default: false })
  friendsPrivateMessageMembersOnly: boolean;

  @Column({ default: false })
  membersPrivateMessageEnabled: boolean;

  @Column({ default: false })
  membersVoiceCallEnabled: boolean;

  @Column({ default: false })
  guestPrivateMessageEnabled: boolean;

  @Column({ default: false })
  guestVoiceCallEnabled: boolean;

  @Column({ default: false })
  firstMessageDelayEnabled: boolean;

  @Column({ type: 'int', default: 0 })
  firstMessageDelaySeconds: number;

  @Column({ type: 'timestamp', nullable: true })
  firstMessageDelayUpdatedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  guestWaitSeconds: number;

  @Column({ type: 'timestamp', nullable: true })
  guestWaitUpdatedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  memberAndGuestMicDurationSeconds: number;

  @Column({ type: 'varchar', length: 5, default: SiteLanguage.TR })
  siteLanguage: SiteLanguage;

  @Column({ type: 'varchar', length: 20, default: AccessLevel.EVERYONE })
  chatImageSendPermission: AccessLevel;

  @Column({ type: 'varchar', length: 20, default: AccessLevel.MEMBERS })
  chatVoiceSendPermission: AccessLevel;

  @Column({ type: 'varchar', length: 20, default: AccessLevel.NONE })
  chatVoiceRecordSendPermission: AccessLevel;

  @Column({ type: 'varchar', length: 20, default: AccessLevel.EVERYONE })
  chatYoutubeSendPermission: AccessLevel;

  @Column({ type: 'varchar', length: 255, nullable: true })
  siteName?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  siteTitle?: string | null;

  @Column({ type: 'text', nullable: true })
  siteDescription?: string | null;

  @Column({ type: 'text', nullable: true })
  homePageHtml?: string | null;

  @Column({ type: 'text', nullable: true })
  welcomeMessageTemplate?: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: LoginDesignType.STANDARD,
  })
  activeLoginDesign: LoginDesignType;

  @Column({ type: 'int', default: 0 })
  maxUserCount: number;

  @Column({ default: false })
  maintenanceMode: boolean;

  @Column({ default: true })
  showMicrophonesOnMobile: boolean;

  @Column({ type: 'varchar', length: 20, default: '#0057B8' })
  mobileHeaderColor: string;

  @Column({ type: 'varchar', length: 20, default: '#0057B8' })
  mobileFooterColor: string;

  @Column({ type: 'text', nullable: true })
  homePageImage?: string | null;

  @Column({ type: 'text', nullable: true })
  homePageLogo?: string | null;

  @Column({ type: 'text', nullable: true })
  chatHeaderLogo?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  siteOwnerUsernames?: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  managerUsernames?: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  premiumArticleTopTitle?: string | null;

  @Column({ type: 'text', nullable: true })
  premiumArticleTopContent?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  premiumArticleMiddleTitle?: string | null;

  @Column({ type: 'text', nullable: true })
  premiumArticleMiddleContent?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  premiumArticleBottomTitle?: string | null;

  @Column({ type: 'text', nullable: true })
  premiumArticleBottomContent?: string | null;

  @Column({ type: 'text', nullable: true })
  premiumAndroidAppUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  premiumIosAppUrl?: string | null;
}
