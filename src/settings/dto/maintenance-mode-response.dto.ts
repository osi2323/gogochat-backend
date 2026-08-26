import { ApiProperty } from '@nestjs/swagger';
import { LoginDesignType } from '../entities/system-settings.entity';

export class MaintenanceModeResponseDto {
  @ApiProperty({ example: false })
  maintenanceMode: boolean;

  @ApiProperty({ example: 'KingMobile', nullable: true })
  siteName?: string | null;

  @ApiProperty({ example: 'KingMobile Sohbet', nullable: true })
  siteTitle?: string | null;

  @ApiProperty({ example: '<p>Hos geldiniz</p>', nullable: true })
  homePageHtml?: string | null;

  @ApiProperty({ example: 'Merhaba [username]', nullable: true })
  welcomeMessageTemplate?: string | null;

  @ApiProperty({
    enum: LoginDesignType,
    example: LoginDesignType.STANDARD,
  })
  activeLoginDesign: LoginDesignType;

  @ApiProperty({ example: 'path/to/image.jpg', nullable: true })
  homePageImage?: string | null;

  @ApiProperty({ example: 'path/to/logo.png', nullable: true })
  homePageLogo?: string | null;

  @ApiProperty({ example: 'path/to/chat-logo.png', nullable: true })
  chatHeaderLogo?: string | null;

  @ApiProperty({ type: [String] })
  siteOwnerUsernames: string[];

  @ApiProperty({ type: [String] })
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
