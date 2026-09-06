import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './preferences.dto';
export declare class PreferencesController {
    private s;
    constructor(s: PreferencesService);
    get(r: any): Promise<import("./user-preference.entity").UserPreference>;
    update(r: any, d: UpdatePreferencesDto): Promise<import("./user-preference.entity").UserPreference>;
}
