import { AuthModule } from '../auth/auth.module';
import{Module}from'@nestjs/common';import{TypeOrmModule}from'@nestjs/typeorm';import{UserPreference}from'./user-preference.entity';import{PreferencesService}from'./preferences.service';import{PreferencesController}from'./preferences.controller';@Module({imports:[AuthModule,TypeOrmModule.forFeature([UserPreference])],providers:[PreferencesService],controllers:[PreferencesController],exports:[PreferencesService]})export class PreferencesModule{}

