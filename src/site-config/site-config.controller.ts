import {Controller,Get} from '@nestjs/common';import {SiteConfigService} from './site-config.service';
@Controller('site-config')export class SiteConfigController{constructor(private config:SiteConfigService){}@Get()get(){return this.config.publicConfig()}}
